// src/services/dietService.js
// Chế độ ăn (DAT-25, FR-23, FR-26):
//   - chế độ "bắt buộc" (diet_types.is_strict, vd Ăn chay, Thuần chay) là RÀNG BUỘC CỨNG: chỉ giữ món mang thẻ
//     của chế độ (diet_types.tag_id, Admin gắn trong file nhập món) VÀ không chứa nguyên liệu động vật;
//   - chế độ còn lại (Eat Clean, Keto, Tăng cơ…) là ràng buộc mềm: chỉ đưa vào câu lệnh gửi mô hình.
// Kiểm tra nguyên liệu là lớp bảo vệ thứ hai, phòng khi món bị gắn nhầm thẻ.

import { supabaseAdmin } from '../config/supabase.js';
import { cached, getIngredientIndex } from './cacheService.js';
import { DEFAULT_STRICT_CODES, DIET_RULES, violatesDiet } from '../utils/dietRules.js';

export { DIET_RULES, violatesDiet, detectQuestionDietCodes } from '../utils/dietRules.js';

let warnedNoTag = false;

// ── Danh mục chế độ ăn ───────────────────────────────────────────────────────

/** Mọi chế độ ăn kèm tag_id, is_strict (đệm 60 giây); CSDL chưa có hai cột này thì coi chay/thuần chay là bắt buộc, không có thẻ. */
export function getDietTypes() {
  return cached('catalog:diet_types', 60 * 1000, async () => {
    const full = await supabaseAdmin.from('diet_types').select('id, code, name, tag_id, is_strict').order('id');
    if (!full.error) return full.data || [];
    console.warn('[Diet] Chưa có cột diet_types.tag_id/is_strict, chỉ lọc chay theo nguyên liệu:', full.error.message);
    const basic = await supabaseAdmin.from('diet_types').select('id, code, name').order('id');
    if (basic.error) throw basic.error;
    return (basic.data || []).map((d) => ({ ...d, tag_id: null, is_strict: DEFAULT_STRICT_CODES.includes(d.code) }));
  }, { stale: true });
}

/**
 * Bộ lọc cứng cho các chế độ bắt buộc trong hồ sơ (dietTypeIds) và trong câu hỏi (dietCodes).
 * Trả về:
 *   strict: [{ id, code, name, promptRule }] – để đưa vào câu lệnh gửi mô hình
 *   forbiddenIngredientIds: id nguyên liệu động vật bị loại (chưa mở rộng nguyên liệu con)
 *   dishFilter(dish): món có đủ thẻ chế độ không (null khi không có chế độ bắt buộc)
 */
export async function buildDietFilter({ dietTypeIds = [], dietCodes = [] } = {}) {
  const ids = new Set(dietTypeIds.map(Number));
  const codes = new Set(dietCodes);
  const all = await getDietTypes();
  let strict = all.filter((d) => d.is_strict && DIET_RULES[d.code] && (ids.has(Number(d.id)) || codes.has(d.code)));
  // Thuần chay đã bao gồm ăn chay
  if (strict.some((d) => d.code === 'vegan')) strict = strict.filter((d) => d.code !== 'vegetarian');
  if (strict.length === 0) return { strict: [], forbiddenIngredientIds: new Set(), dishFilter: null };

  const forbiddenIngredientIds = new Set();
  for (const ing of await getIngredientIndex()) {
    if (strict.some((d) => violatesDiet(ing.name, d.code))) forbiddenIngredientIds.add(Number(ing.id));
  }

  // Mỗi chế độ bắt buộc: món phải mang ít nhất một thẻ trong satisfiedBy
  const tagSets = strict.map((d) => {
    const accepted = DIET_RULES[d.code].satisfiedBy;
    return new Set(all.filter((x) => accepted.includes(x.code) && x.tag_id != null).map((x) => Number(x.tag_id)));
  });
  const enforceTags = tagSets.every((s) => s.size > 0);
  if (!enforceTags && !warnedNoTag) {
    warnedNoTag = true;
    console.warn('[Diet] Chế độ bắt buộc chưa gắn thẻ (diet_types.tag_id), chỉ lọc theo nguyên liệu. Gắn diet_types.tag_id (thẻ Chay / Thuần chay) và is_strict = true trong CSDL.');
  }
  const dishFilter = enforceTags
    ? (dish) => {
      const tags = new Set((dish.dish_tags || []).map((t) => Number(t.tag_id)));
      return tagSets.every((s) => [...s].some((id) => tags.has(id)));
    }
    : null;

  return {
    strict: strict.map((d) => ({ id: d.id, code: d.code, name: d.name, promptRule: DIET_RULES[d.code].promptRule })),
    forbiddenIngredientIds,
    dishFilter,
  };
}
