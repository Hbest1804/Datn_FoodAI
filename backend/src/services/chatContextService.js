// src/services/chatContextService.js
// Ngữ cảnh cho chatbot khách (4.4.1) và cá nhân hóa (4.6.4):
//   - chặn câu hỏi ngoài chủ đề theo ba lớp
//   - truy hồi món liên quan bằng véc-tơ và lọc an toàn dị ứng/không thích
//   - chuẩn hóa danh sách nguyên liệu có sẵn

import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './aiService.js';
import { cosineSimilarity, getDishEmbeddings } from './embeddingService.js';
import { getIngredientChildren, getIngredientIndex, getPublishedDishes } from './cacheService.js';
import { containsBannedWords } from '../utils/bannedWords.js';
import { normalizeText } from '../utils/textUtils.js';
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

// ── Dị ứng người dùng nêu ngay trong câu hỏi ("tôi dị ứng hải sản, …") ──────
// Bảng nguyên liệu gần như chưa gắn nhóm dị ứng nên nhận diện theo tên (có dấu, khớp trọn từ),
// gồm cả gia vị ẩn chứa chất gây dị ứng như nước mắm, mắm tôm, nước tương, dầu hào.
const CRUSTACEAN = ['tôm', 'tép', 'cua', 'ghẹ', 'ruốc', 'riêu', 'giáp xác'];
const FISH = ['cá', 'nước mắm', 'mắm cá', 'chả cá', 'khô cá'];
const QUESTION_ALLERGENS = [
  { code: 'crustacean', name: 'Tôm, cua và hải sản có vỏ (giáp xác)', detect: CRUSTACEAN, ingredients: CRUSTACEAN },
  {
    code: 'seafood', name: 'Hải sản (tôm, cua, cá, mực, nhuyễn thể)', detect: ['hải sản'],
    ingredients: [...CRUSTACEAN, ...FISH, 'mực', 'bạch tuộc', 'ngao', 'nghêu', 'sò', 'hến', 'hàu', 'ốc', 'mắm', 'dầu hào'],
    except: ['dầu hào chay'],
  },
  { code: 'fish', name: 'Cá (kể cả nước mắm)', detect: ['cá'], ingredients: FISH },
  { code: 'peanut', name: 'Đậu phộng (lạc)', detect: ['đậu phộng', 'lạc'], ingredients: ['đậu phộng', 'lạc'] },
  {
    code: 'dairy', name: 'Sữa bò và chế phẩm từ sữa', detect: ['sữa', 'lactose'],
    ingredients: ['sữa', 'bơ lạt', 'bơ', 'phô mai', 'kem', 'whey'],
    except: ['sữa đậu nành', 'sữa hạt', 'sữa dừa', 'hàu sữa'],
  },
  { code: 'egg', name: 'Trứng', detect: ['trứng'], ingredients: ['trứng', 'mayonnaise'] },
  {
    code: 'gluten', name: 'Gluten (lúa mì)', detect: ['gluten', 'lúa mì', 'bột mì'],
    ingredients: ['bột mì', 'bánh mì', 'mì tôm', 'mì gói', 'bánh bao', 'bột chiên giòn', 'bột chiên xù', 'nước tương', 'xì dầu', 'bia'],
  },
  {
    code: 'soy', name: 'Đậu nành', detect: ['đậu nành', 'đậu tương'],
    ingredients: ['đậu nành', 'đậu tương', 'đậu phụ', 'đậu hũ', 'tàu hũ', 'tào phớ', 'váng đậu', 'nước tương', 'xì dầu', 'tương đen', 'tương bần', 'miso', 'dầu hào'],
  },
  { code: 'sesame', name: 'Vừng (mè)', detect: ['mè', 'vừng'], ingredients: ['mè', 'vừng', 'tahini'] },
  {
    code: 'tree_nut', name: 'Các loại hạt cây (điều, óc chó, hạnh nhân…)',
    detect: ['hạt điều', 'óc chó', 'hạnh nhân', 'macca', 'mắc ca', 'hồ đào', 'hạt dẻ', 'hạt cây'],
    ingredients: ['hạt điều', 'óc chó', 'hạnh nhân', 'macca', 'mắc ca', 'hồ đào', 'hạt dẻ'],
  },
];
// Cụm báo hiệu dị ứng; phần nêu chất gây dị ứng kéo dài tới dấu câu hoặc liên từ kế tiếp
const ALLERGY_TRIGGER_RE = /(dị ứng|không ăn được|kiêng)\s+([^,.;:!?\n]*?)(?=[,.;:!?\n]|\s(?:thì|nên|nhưng|mà|muốn|có|ăn|làm|gợi|cho)\s|$)/gu;

/** Regex khớp trọn từ tiếng Việt có dấu (\b của JS không hiểu chữ có dấu). */
function wordsRe(words) {
  const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
  return new RegExp(`(?:^|[^\\p{L}])(?:${alt})(?=$|[^\\p{L}])`, 'u');
}
for (const a of QUESTION_ALLERGENS) {
  a.detectRe = wordsRe(a.detect);
  a.ingredientRe = wordsRe(a.ingredients);
  a.exceptRe = a.except ? wordsRe(a.except) : null;
}

/**
 * Nhận diện chất gây dị ứng người dùng nêu trong câu hỏi.
 * Trả về các nhóm dị ứng { id, name } (để đưa vào câu lệnh gửi mô hình) và id nguyên liệu phải loại, kèm nguyên liệu con.
 */
export async function detectQuestionAllergens(content) {
  const text = (content || '').normalize('NFC').toLowerCase();
  const mentioned = [...text.matchAll(ALLERGY_TRIGGER_RE)].map((m) => m[2]).join(' | ');
  const allergens = mentioned ? QUESTION_ALLERGENS.filter((a) => a.detectRe.test(mentioned)) : [];
  if (allergens.length === 0) return { allergens: [], ingredientIds: new Set() };

  const ids = new Set();
  for (const ing of await getIngredientIndex()) {
    const name = (ing.name || '').normalize('NFC').toLowerCase();
    if (allergens.some((a) => a.ingredientRe.test(name.replace(a.exceptRe || /$^/, '')))) ids.add(Number(ing.id));
  }
  return {
    allergens: allergens.map((a) => ({ id: `q:${a.code}`, name: a.name })),
    ingredientIds: new Set((await withDescendants(ids)).keys()),
  };
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
export async function retrieveDishes({ questionVector, content, pantry, forbiddenIngredientIds = new Set(), limit = 8 }) {
  const dishes = await getPublishedDishes();
  const safe = dishes.filter((d) =>
    !(d.dish_ingredients || []).some((di) => forbiddenIngredientIds.has(Number(di.ingredient_id))));

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

  const scored = safe.map((d) => {
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

  scored.sort((a, b) => b.score - a.score || Number(b.dish.avg_rating) - Number(a.dish.avg_rating));
  return scored.slice(0, limit).map(({ dish: d }) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    image_url: d.image_url,
    category: d.category,
    cook_time_minutes: d.cook_time_minutes,
    difficulty: d.difficulty,
    calories: d.calories,
    avg_rating: d.avg_rating,
    favorite_count: d.favorite_count,
  }));
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
