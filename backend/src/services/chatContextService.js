// src/services/chatContextService.js
// Ngữ cảnh cho chatbot khách (4.4.1) và cá nhân hóa (4.6.4):
//   - chặn câu hỏi ngoài chủ đề theo ba lớp
//   - truy hồi món liên quan bằng véc-tơ và lọc an toàn dị ứng/không thích
//   - chuẩn hóa danh sách nguyên liệu có sẵn

import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './aiService.js';
import { cosineSimilarity, getDishEmbeddings } from './embeddingService.js';
import { cached, getIngredientChildren, getIngredientIndex, getPublishedDishes } from './cacheService.js';
import { containsBannedWords } from '../utils/bannedWords.js';
import { normalizeText } from '../utils/textUtils.js';
import { detectQuestionAllergenGroups, ingredientMatchesAllergen } from '../utils/allergenRules.js';
import { looksLikePromptInjection } from '../utils/promptGuard.js';
import { extractRequestedDish, findDishByRequestedName } from '../utils/requestedDish.js';
import { buildDishPredicates, metricComparator, parseQuestionFilters } from '../utils/questionFilters.js';
import { buildDietFilter, detectQuestionDietCodes } from './dietService.js';
import { ApiError } from '../utils/http.js';

const MAX_PANTRY_ITEMS = 20;

const OUT_OF_SCOPE_REPLY = 'Xin lỗi, mình là trợ lý ẩm thực nên chỉ hỗ trợ các câu hỏi về món ăn, nấu nướng, nguyên liệu và dinh dưỡng. Bạn muốn mình gợi ý món gì hôm nay không?';

// Từ khóa ẩm thực (không dấu) – lớp 1 dùng để nhận diện nhanh câu hỏi chắc chắn đúng chủ đề
const CULINARY_KEYWORDS = [
  'nau', 'mon', 'an', 'canh', 'kho', 'xao', 'nuong', 'chien', 'hap', 'luoc', 'thit', 'ca', 'rau', 'trung',
  'bua', 'calo', 'kcal', 'cong thuc', 'nguyen lieu', 'thuc don', 'chay', 'dinh duong', 'mon an', 'sot',
  'hai san', 'ga', 'bo', 'heo', 'tom', 'muc', 'bun', 'pho', 'com', 'banh', 'che', 'lau', 'gia vi', 'tu lanh',
  'an kieng', 'giam can', 'eat clean', 'keto', 'do an', 'mon ngon', 'bep', 'nem', 'goi', 'salad', 'soup',
];
const CULINARY_RE = new RegExp(`(^|\\s)(${CULINARY_KEYWORDS.join('|')})(\\s|$)`);

// Tên thực phẩm trùng mặt chữ với từ trong danh sách cấm (dùng chung cho kiểm duyệt bình luận)
const FOOD_TERMS_LIKE_BANNED_RE = /óc chó/giu;

// Câu mô tả chủ đề ẩm thực – véc-tơ của nó là tâm chủ đề cho lớp 2
const TOPIC_ANCHOR_TEXT = 'Câu hỏi về ẩm thực, món ăn Việt Nam, công thức nấu ăn, nguyên liệu, gia vị, cách chế biến, thực đơn bữa ăn, dinh dưỡng, calo và chế độ ăn uống.';
let topicAnchor = null;

async function getTopicAnchor() {
  if (!topicAnchor) topicAnchor = (await generateEmbedding(TOPIC_ANCHOR_TEXT)).embedding;
  return topicAnchor;
}

/**
 * Đọc và kiểm tra nguyên liệu có sẵn { ingredient_ids, custom_ingredients } (tối đa 20 nguyên liệu).
 * Chấp nhận khóa cũ "fridge" để giao diện cũ vẫn dùng được.
 */
export async function parsePantry(body) {
  const raw = body?.pantry ?? body?.fridge;
  const pantry = { ingredient_ids: [], ingredient_names: [], custom_ingredients: [] };
  if (!raw || typeof raw !== 'object') return pantry;

  const ids = Array.isArray(raw.ingredient_ids) ? raw.ingredient_ids : [];
  const custom = Array.isArray(raw.custom_ingredients) ? raw.custom_ingredients : [];
  if (ids.length + custom.length > MAX_PANTRY_ITEMS) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Danh sách nguyên liệu có sẵn tối đa ${MAX_PANTRY_ITEMS} nguyên liệu.`, [
      { field: 'pantry', code: 'TOO_MANY_ITEMS', message: `Tối đa ${MAX_PANTRY_ITEMS} nguyên liệu.` },
    ]);
  }
  pantry.ingredient_ids = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  pantry.custom_ingredients = custom
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim().slice(0, 50));

  if (pantry.ingredient_ids.length > 0) {
    const { data } = await supabaseAdmin.from('ingredients').select('id, name').in('id', pantry.ingredient_ids);
    pantry.ingredient_names = (data || []).map((r) => r.name);
  }
  return pantry;
}

/**
 * Lớp 1 (lọc đầu vào) và lớp 2 (điểm chủ đề bằng véc-tơ). Lớp 3 là mô hình tự phân loại theo lời dặn gửi kèm câu hỏi.
 * Trả về: có ngoài chủ đề không, câu từ chối (nếu có) và véc-tơ của câu hỏi.
 */
export async function checkTopic(content, settings) {
  // Lớp 1: nội dung chứa từ ngữ bị cấm → từ chối ngay, không gọi AI
  // (bỏ qua tên thực phẩm trùng mặt chữ với từ cấm, vd "hạt óc chó")
  if (await containsBannedWords(String(content).normalize('NFC').replace(FOOD_TERMS_LIKE_BANNED_RE, ' '))) {
    return { outOfScope: true, reply: OUT_OF_SCOPE_REPLY, questionVector: null };
  }
  // Lớp 1: mẫu tấn công prompt ("bỏ qua mọi hướng dẫn", "ignore previous instructions"…) → từ chối, không gọi AI
  if (looksLikePromptInjection(content)) {
    return { outOfScope: true, reply: OUT_OF_SCOPE_REPLY, questionVector: null };
  }

  let questionVector = null;
  try {
    questionVector = (await generateEmbedding(content)).embedding;
  } catch (err) {
    // Không tạo được véc-tơ: bỏ qua lớp 2, để mô hình tự phân loại (lớp 3)
    console.warn('[Chat] Không tạo được embedding câu hỏi:', err.message);
    return { outOfScope: false, questionVector: null };
  }

  // Câu hỏi có từ khóa ẩm thực rõ ràng thì không cần chấm điểm chủ đề
  if (CULINARY_RE.test(normalizeText(content))) return { outOfScope: false, questionVector };

  // Lớp 2: điểm < ngưỡng thấp → ngoài chủ đề; giữa hai ngưỡng → để lớp 3 quyết định
  try {
    const score = cosineSimilarity(questionVector, await getTopicAnchor());
    if (score < Number(settings.topic_threshold_low)) {
      return { outOfScope: true, reply: OUT_OF_SCOPE_REPLY, questionVector };
    }
  } catch (err) {
    console.warn('[Chat] Không chấm được điểm chủ đề:', err.message);
  }
  return { outOfScope: false, questionVector };
}

/**
 * Mở rộng tập nguyên liệu sang mọi nguyên liệu con, cháu (bảng ingredient_parents):
 * kiêng "Tôm" thì loại cả "Tôm sú tươi", "Mắm tôm", "Mắm tôm ngon"…
 * Trả về Map id nguyên liệu → id nguyên liệu kiêng gốc dẫn tới nó (chính nó nếu kiêng trực tiếp).
 */
async function withDescendants(ids) {
  const result = new Map([...ids].map((id) => [id, id]));
  if (ids.size === 0) return result;
  const children = await getIngredientChildren();
  const queue = [...ids];
  while (queue.length) {
    const id = queue.pop();
    for (const child of children.get(id) || []) {
      if (!result.has(child)) { result.set(child, result.get(id)); queue.push(child); }
    }
  }
  return result;
}

/** Id nguyên liệu bị cấm với người dùng: thuộc nhóm dị ứng hoặc danh sách không thích đã khai, kèm mọi nguyên liệu con của chúng. */
export async function getForbiddenIngredientIds({ allergenGroupIds = [], dislikedIngredientIds = [] }) {
  const forbidden = new Set(dislikedIngredientIds.map(Number));
  if (allergenGroupIds.length > 0) {
    const groups = new Set(allergenGroupIds.map(Number));
    for (const ing of await getIngredientIndex()) {
      if (groups.has(Number(ing.allergen_group_id))) forbidden.add(Number(ing.id));
    }
  }
  return new Set((await withDescendants(forbidden)).keys());
}

/** Map id nhóm dị ứng → mã (allergen_groups.code), đệm 5 phút. Lỗi đọc bảng thì trả Map rỗng (vẫn lọc theo tên). */
function getAllergenGroupCodes() {
  return cached('catalog:allergen_group_codes', 5 * 60 * 1000, async () => {
    const { data, error } = await supabaseAdmin.from('allergen_groups').select('id, code');
    if (error) return new Map();
    return new Map((data || []).map((g) => [Number(g.id), g.code]));
  }, { stale: true });
}

/**
 * Nhận diện chất gây dị ứng người dùng nêu trong câu hỏi (luật ở utils/allergenRules.js, bỏ qua câu phủ định).
 * Trả về các nhóm dị ứng { id, name } (để đưa vào câu lệnh gửi mô hình) và id nguyên liệu phải loại, kèm nguyên liệu con.
 */
export async function detectQuestionAllergens(content) {
  const allergens = detectQuestionAllergenGroups(content);
  if (allergens.length === 0) return { allergens: [], ingredientIds: new Set() };

  // Nguyên liệu bị loại: tên khớp nhóm dị ứng, hoặc đã gắn allergen_group_id của nhóm cùng mã (allergen_groups.code)
  const groupCodes = await getAllergenGroupCodes();
  const ids = new Set();
  for (const ing of await getIngredientIndex()) {
    const code = groupCodes.get(Number(ing.allergen_group_id));
    if (allergens.some((a) => a.code === code || ingredientMatchesAllergen(ing.name, a))) ids.add(Number(ing.id));
  }
  return {
    allergens: allergens.map((a) => ({ id: `q:${a.code}`, name: a.name })),
    ingredientIds: new Set((await withDescendants(ids)).keys()),
  };
}

/**
 * Ràng buộc cứng của chế độ ăn bắt buộc (Ăn chay, Thuần chay) trong hồ sơ và trong câu hỏi.
 * Trả về { strict, forbiddenIngredientIds (đã mở rộng nguyên liệu con), dishFilter } – xem dietService.buildDietFilter.
 */
export async function getDietConstraints({ dietTypeIds = [], content = '' } = {}) {
  const diet = await buildDietFilter({ dietTypeIds, dietCodes: detectQuestionDietCodes(content) });
  return { ...diet, forbiddenIngredientIds: new Set((await withDescendants(diet.forbiddenIngredientIds)).keys()) };
}

/**
 * Nguyên liệu kiêng mà người dùng đã khai trong hồ sơ khẩu vị, kèm nguyên liệu cùng nhóm;
 * Map id → id nguyên liệu đã khai dẫn tới nó. Khách trả Map rỗng.
 */
export async function getUserAvoidedIngredientIds(userId) {
  if (!userId) return new Map();
  const { data, error } = await supabaseAdmin.from('user_disliked_ingredients').select('ingredient_id').eq('user_id', userId);
  if (error) throw error;
  return withDescendants(new Set((data || []).map((r) => Number(r.ingredient_id))));
}

/**
 * Truy hồi tối đa `limit` món đang hiển thị, đã loại món chứa nguyên liệu bị cấm.
 * Xếp theo độ tương đồng véc-tơ với câu hỏi, cộng điểm khi dùng được nguyên liệu có sẵn.
 */
export async function retrieveDishes(options) {
  return (await retrieveDishesWithStatus(options)).dishes;
}

/**
 * Như retrieveDishes nhưng kèm trạng thái truy hồi để chatbot chọn cách trả lời (UC chatbot luồng 4a, 5a):
 *  • 'ok'           – còn món phù hợp;
 *  • 'none'         – không có món phù hợp: danh mục rỗng, hoặc người dùng xin cách làm một món cụ thể
 *                     mà tên món đó không có trong hệ thống (vd "cách gói bánh chưng");
 *  • 'all_excluded' – có món nhưng đều chứa nguyên liệu kiêng / dị ứng hoặc trái chế độ ăn bắt buộc.
 */
export async function retrieveDishesWithStatus({ questionVector, content, pantry, forbiddenIngredientIds = new Set(), dishFilter = null, limit = 8 }) {
  const dishes = await getPublishedDishes();
  const notes = [];
  // Hỏi cách làm (hoặc số liệu) một món không có trong hệ thống: không gửi món "gần giống" cho AI,
  // để AI đề xuất công thức tham khảo và ghi rõ do AI đề xuất (UC07 luồng 4a)
  const requested = extractRequestedDish(content);
  if (requested && !findDishByRequestedName(requested, dishes)) {
    notes.push('Món người dùng hỏi KHÔNG có trong hệ thống: không gắn thẻ món nào; mọi số liệu (calo, dinh dưỡng, chi phí) chỉ là ước tính tham khảo chung, phải nói rõ "không phải số liệu của hệ thống".');
    return { dishes: [], status: 'none', notes };
  }
  const forbiddenOf = (d) => (d.dish_ingredients || [])
    .filter((di) => forbiddenIngredientIds.has(Number(di.ingredient_id)))
    .map((di) => di.ingredient?.name)
    .filter(Boolean);
  const isSafe = (d) => (!dishFilter || dishFilter(d)) && forbiddenOf(d).length === 0;
  const safe = dishes.filter(isSafe);

  // Món người dùng nhắc đích danh: món an toàn được đưa lên đầu kèm công thức; món bị loại thì báo lý do cho mô hình
  const named = findNamedDishes(content, dishes, requested);
  const namedSafe = named.filter(isSafe);
  for (const d of named.filter((x) => !isSafe(x))) {
    const bad = [...new Set(forbiddenOf(d))];
    notes.push(bad.length
      ? `Món "${d.name}" có trong hệ thống nhưng CHỨA nguyên liệu người dùng phải kiêng: ${bad.join(', ')}. Không gắn thẻ món này. Cảnh báo rõ nguyên liệu đó; nếu hướng dẫn thì chỉ đưa phiên bản đã bỏ/thay hẳn nguyên liệu đó (nêu nguyên liệu thay thế) và ghi rõ là "công thức tham khảo đã điều chỉnh, khác công thức trong hệ thống"; có thể gợi ý thêm món an toàn trong danh sách.`
      : `Món "${d.name}" có trong hệ thống nhưng KHÔNG hợp chế độ ăn bắt buộc của người dùng. Không gắn thẻ và không hướng dẫn món này; nói rõ lý do và gợi ý món thay thế phù hợp trong danh sách.`);
  }

  if (safe.length === 0) {
    return { dishes: [], status: dishes.length > 0 ? 'all_excluded' : 'none', notes };
  }

  // Điều kiện định lượng trong câu hỏi (calo, đạm, tinh bột, chi phí, thời gian, độ khó, loại món): lọc theo số liệu CSDL.
  // Điều kiện nào loại hết món thì bỏ qua và báo cho mô hình biết không có món thỏa điều kiện đó.
  const qf = parseQuestionFilters(content);
  let pool = safe;
  const applied = [];
  for (const p of buildDishPredicates(qf)) {
    const next = pool.filter(p.test);
    if (next.length > 0) { pool = next; applied.push(p.label); }
    else notes.push(`Không có món nào trong hệ thống thỏa điều kiện "${p.label}" (cùng các điều kiện khác của câu hỏi): nói rõ điều này, không khẳng định món khác thỏa điều kiện.`);
  }
  if (applied.length > 0) {
    notes.push(`Danh sách món đã được hệ thống lọc đúng điều kiện: ${applied.join('; ')}. Gợi ý và gắn thẻ 2–4 món trong danh sách (nếu có đủ), nêu số liệu tương ứng của từng món lấy từ dữ liệu.`);
  }

  let embeddings = new Map();
  if (questionVector) {
    try {
      embeddings = await getDishEmbeddings();
    } catch (err) {
      console.warn('[Chat] Không đọc được dish_embeddings:', err.message);
    }
  }

  const pantryIds = new Set(pantry?.ingredient_ids || []);
  const words = normalizeText(content).split(' ').filter((w) => w.length >= 2);

  const scored = pool.map((d) => {
    const vec = embeddings.get(d.id);
    let score = vec ? cosineSimilarity(questionVector, vec) : 0;
    if (!vec) {
      // Không có véc-tơ: dùng số từ khóa trùng tên/mô tả làm điểm thay thế
      const hay = normalizeText(`${d.name} ${d.description || ''} ${d.category || ''}`);
      score = words.filter((w) => hay.includes(w)).length / Math.max(words.length, 1) * 0.5;
    }
    const ingIds = (d.dish_ingredients || []).map((di) => Number(di.ingredient_id));
    const pantryHits = ingIds.filter((id) => pantryIds.has(id)).length;
    if (pantryHits > 0) score += 0.2 * (pantryHits / ingIds.length);
    return { dish: d, score };
  });

  const byMetric = metricComparator(qf);
  scored.sort((a, b) => (byMetric ? byMetric(a.dish, b.dish) : 0)
    || b.score - a.score || Number(b.dish.avg_rating) - Number(a.dish.avg_rating));
  const ordered = [...namedSafe, ...scored.map((s) => s.dish).filter((d) => !namedSafe.includes(d))];
  const recipes = await getDishRecipes(namedSafe.map((d) => d.id));
  const top = ordered.slice(0, limit).map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    image_url: d.image_url,
    category: d.category,
    cook_time_minutes: d.cook_time_minutes,
    difficulty: d.difficulty,
    servings: d.servings,
    est_cost: d.est_cost,
    calories: d.calories,
    protein_g: d.protein_g,
    carbs_g: d.carbs_g,
    fat_g: d.fat_g,
    avg_rating: d.avg_rating,
    favorite_count: d.favorite_count,
    asked: namedSafe.includes(d) || undefined,
    recipe: recipes.get(d.id),
  }));
  if (namedSafe.length > 0) {
    notes.push(`Người dùng hỏi về món: ${namedSafe.map((d) => d.name).join(', ')} (có "asked": true và công thức "recipe" trong dữ liệu). Trả lời theo đúng nguyên liệu, định lượng, các bước và thời gian trong "recipe"; số liệu dinh dưỡng lấy đúng dữ liệu; gắn thẻ món này.`);
  }
  return { dishes: top, status: top.length > 0 ? 'ok' : 'none', notes };
}

/**
 * Món người dùng nhắc đích danh trong câu hỏi: tên món (bỏ dấu) xuất hiện nguyên cụm trong câu,
 * hoặc khớp tên món xin công thức/số liệu (extractRequestedDish). Tối đa 2 món, ưu tiên tên dài.
 */
function findNamedDishes(content, dishes, requested) {
  const text = ` ${normalizeText(content).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  const found = dishes
    .filter((d) => {
      const name = normalizeText(d.name).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return name.split(' ').length >= 2 && text.includes(` ${name} `);
    })
    .sort((a, b) => b.name.length - a.name.length);
  if (requested) {
    const d = findDishByRequestedName(requested, dishes);
    if (d && !found.includes(d)) found.unshift(d);
  }
  return found.slice(0, 2);
}

/** Nguyên liệu (kèm định lượng) và các bước nấu của món, đệm 5 phút. Lỗi đọc thì bỏ qua (vẫn trả lời được). */
async function getDishRecipes(ids) {
  const out = new Map();
  await Promise.all(ids.map(async (id) => {
    try {
      const recipe = await cached(`chat:recipe:${id}`, 5 * 60 * 1000, async () => {
        const [ings, steps] = await Promise.all([
          supabaseAdmin.from('dish_ingredients').select('quantity, unit, is_optional, ingredients(name)').eq('dish_id', id),
          supabaseAdmin.from('recipe_steps').select('step_order, content').eq('dish_id', id).order('step_order'),
        ]);
        if (ings.error) throw ings.error;
        if (steps.error) throw steps.error;
        return {
          ingredients: (ings.data || []).map((r) => `${r.ingredients?.name} ${Number(r.quantity)} ${r.unit}${r.is_optional ? ' (tùy chọn)' : ''}`),
          steps: (steps.data || []).map((s) => `${s.step_order}. ${s.content}`),
        };
      });
      out.set(id, recipe);
    } catch (err) {
      console.warn('[Chat] Không đọc được công thức món', id, err.message);
    }
  }));
  return out;
}

/** Định dạng thẻ món trả về cho giao diện. */
export function toDishCard(d) {
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    image_url: d.image_url,
    category: d.category,
    cook_time_minutes: d.cook_time_minutes,
    difficulty: d.difficulty,
  };
}
