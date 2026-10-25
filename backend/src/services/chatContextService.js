// src/services/chatContextService.js
// Ngữ cảnh cho chatbot khách (4.4.1) và cá nhân hóa (4.6.4):
//   - chặn câu hỏi ngoài chủ đề theo ba lớp
//   - truy hồi món liên quan bằng véc-tơ và lọc an toàn dị ứng/không thích
//   - chuẩn hóa danh sách nguyên liệu có sẵn

import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './aiService.js';
import { cosineSimilarity, getDishEmbeddings } from './embeddingService.js';
import { getIngredientIndex, getPublishedDishes } from './cacheService.js';
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
  if (await containsBannedWords(content)) {
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

/** Id nguyên liệu bị cấm với người dùng: thuộc nhóm dị ứng hoặc nằm trong danh sách không thích mà người dùng đã khai. */
export async function getForbiddenIngredientIds({ allergenGroupIds = [], dislikedIngredientIds = [] }) {
  const forbidden = new Set(dislikedIngredientIds.map(Number));
  if (allergenGroupIds.length > 0) {
    const groups = new Set(allergenGroupIds.map(Number));
    for (const ing of await getIngredientIndex()) {
      if (groups.has(Number(ing.allergen_group_id))) forbidden.add(Number(ing.id));
    }
  }
  return forbidden;
}

/** Id nguyên liệu kiêng mà người dùng đã khai trong hồ sơ khẩu vị; khách trả tập rỗng. */
export async function getUserAvoidedIngredientIds(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabaseAdmin.from('user_disliked_ingredients').select('ingredient_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => Number(r.ingredient_id)));
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
