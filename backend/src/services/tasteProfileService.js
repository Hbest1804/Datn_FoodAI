// src/services/tasteProfileService.js
// Đọc hồ sơ khẩu vị (mục 4.5.1) và tính độ hoàn thiện, dùng chung cho hồ sơ và gợi ý

import { supabaseAdmin } from '../config/supabase.js';

const LEVEL_KEYS = ['spicy_level', 'salty_level', 'sweet_level', 'sour_level'];

/**
 * Độ hoàn thiện hồ sơ 0–100: mức vị 20, nguyên liệu thích 10, chế độ ăn 15, dị ứng 15,
 * mục tiêu calo 20, ngân sách 20. household_size luôn có giá trị mặc định nên không tính.
 */
export function calculateCompleteness(p) {
  let score = 0;
  const prefs = p.taste_prefs || {};
  score += LEVEL_KEYS.filter((k) => Number.isInteger(prefs[k])).length * 5;
  if (Array.isArray(prefs.liked_ingredient_ids) && prefs.liked_ingredient_ids.length > 0) score += 10;
  if (p.diet_type_ids?.length > 0) score += 15;
  if (p.allergen_group_ids?.length > 0) score += 15;
  if (p.calorie_goal) score += 20;
  if (p.budget_min != null || p.budget_max != null) score += 20;
  return Math.min(100, score);
}

const numOrNull = (v) => (v === null || v === undefined ? null : Number(v));

/** Hồ sơ đầy đủ theo cấu trúc kết quả mục 4.5.1; chưa có dữ liệu thì trả trường rỗng và completeness = 0. */
export async function fetchTasteProfile(userId) {
  const [profileRes, dietsRes, allergiesRes, dislikesRes] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('taste_prefs, calorie_goal, household_size, budget_min, budget_max, updated_at').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('user_diets').select('diet_types(id, name)').eq('user_id', userId),
    supabaseAdmin.from('user_allergies').select('allergen_groups(id, name)').eq('user_id', userId),
    supabaseAdmin.from('user_disliked_ingredients').select('ingredients(id, name)').eq('user_id', userId),
  ]);
  if (profileRes.error) throw profileRes.error;

  const profile = profileRes.data;
  const prefs = profile?.taste_prefs || {};
  const dietTypes = (dietsRes.data || []).map((r) => r.diet_types).filter(Boolean);
  const allergenGroups = (allergiesRes.data || []).map((r) => r.allergen_groups).filter(Boolean);
  const dislikedIngredients = (dislikesRes.data || []).map((r) => r.ingredients).filter(Boolean);

  const data = {
    taste_prefs: {
      spicy_level: prefs.spicy_level ?? null,
      salty_level: prefs.salty_level ?? null,
      sweet_level: prefs.sweet_level ?? null,
      sour_level: prefs.sour_level ?? null,
      liked_ingredient_ids: Array.isArray(prefs.liked_ingredient_ids) ? prefs.liked_ingredient_ids : [],
    },
    calorie_goal: numOrNull(profile?.calorie_goal),
    household_size: profile?.household_size ?? null,
    budget_min: numOrNull(profile?.budget_min),
    budget_max: numOrNull(profile?.budget_max),
    diet_type_ids: dietTypes.map((d) => d.id),
    allergen_group_ids: allergenGroups.map((a) => a.id),
    disliked_ingredient_ids: dislikedIngredients.map((i) => Number(i.id)),
    diet_types: dietTypes,
    allergen_groups: allergenGroups,
    disliked_ingredients: dislikedIngredients,
    updated_at: profile?.updated_at ?? null,
  };
  data.completeness = profile ? calculateCompleteness(data) : 0;
  return data;
}
