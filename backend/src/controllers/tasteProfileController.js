// src/controllers/tasteProfileController.js
// Hồ sơ khẩu vị – mục 4.5 và 5.3.1 của tài liệu API

import { supabaseAdmin } from '../config/supabase.js';
import { invalidateRecommendationCache } from '../services/recommendationService.js';
import { recomputeUserVectors } from '../services/embeddingService.js';
import { fetchTasteProfile } from '../services/tasteProfileService.js';
import { sendError, sendOk } from '../utils/http.js';

const LEVEL_KEYS = ['spicy_level', 'salty_level', 'sweet_level', 'sour_level'];

/**
 * 4.5.1 Xem hồ sơ khẩu vị – GET /me/taste-profile
 */
export async function getTasteProfile(req, res) {
  return sendOk(res, await fetchTasteProfile(req.user.id));
}

function isIdArray(v) {
  return Array.isArray(v) && v.every((x) => Number.isInteger(Number(x)) && Number(x) > 0);
}

function isNullableInt(v, min, max = Infinity) {
  return v === null || v === undefined || (Number.isInteger(v) && v >= min && v <= max);
}

/** Kiểm tra miền giá trị; trả về danh sách lỗi theo trường (error.details). */
function validateProfileBody(body) {
  const details = [];
  const add = (field, code, message) => details.push({ field, code, message });
  const prefs = body.taste_prefs ?? {};

  if (typeof prefs !== 'object' || Array.isArray(prefs)) add('taste_prefs', 'INVALID_VALUE', 'taste_prefs phải là object.');
  for (const k of LEVEL_KEYS) {
    if (!isNullableInt(prefs[k], 0, 5)) add(`taste_prefs.${k}`, 'OUT_OF_RANGE', 'Mức vị là số nguyên 0–5.');
  }
  if (prefs.liked_ingredient_ids !== undefined && !isIdArray(prefs.liked_ingredient_ids)) {
    add('taste_prefs.liked_ingredient_ids', 'INVALID_VALUE', 'Phải là mảng id nguyên liệu.');
  }
  if (!isNullableInt(body.calorie_goal, 1, 10000)) add('calorie_goal', 'OUT_OF_RANGE', 'Mục tiêu calo là số nguyên dương.');
  if (!isNullableInt(body.household_size, 1, 20)) add('household_size', 'OUT_OF_RANGE', 'Số người trong gia đình từ 1 đến 20.');
  if (!isNullableInt(body.budget_min, 0)) add('budget_min', 'INVALID_VALUE', 'Ngân sách là số nguyên ≥ 0 hoặc null.');
  if (!isNullableInt(body.budget_max, 0)) add('budget_max', 'INVALID_VALUE', 'Ngân sách là số nguyên ≥ 0 hoặc null.');
  if (Number.isInteger(body.budget_min) && Number.isInteger(body.budget_max) && body.budget_min > body.budget_max) {
    add('budget_min', 'BUDGET_RANGE', 'budget_min không được lớn hơn budget_max.');
  }
  for (const f of ['diet_type_ids', 'allergen_group_ids', 'disliked_ingredient_ids']) {
    if (body[f] !== undefined && !isIdArray(body[f])) add(f, 'INVALID_VALUE', 'Phải là mảng id.');
  }
  return details;
}

async function findMissingIds(table, ids) {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from(table).select('id').in('id', ids);
  if (error) throw error;
  const found = new Set((data || []).map((r) => Number(r.id)));
  return ids.filter((id) => !found.has(id));
}

async function replaceLinks(table, column, userId, ids) {
  const { error: delErr } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
  if (delErr) throw delErr;
  if (ids.length > 0) {
    const { error } = await supabaseAdmin.from(table).insert(ids.map((id) => ({ user_id: userId, [column]: id })));
    if (error) throw error;
  }
}

/**
 * Lưu toàn bộ hồ sơ (dùng chung cho PUT và PATCH).
 */
async function saveTasteProfile(req, res, body) {
  const userId = req.user.id;

  const details = validateProfileBody(body);
  if (details.length > 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu hồ sơ khẩu vị không hợp lệ.', details);
  }

  const prefs = body.taste_prefs ?? {};
  const likedIds = [...new Set((prefs.liked_ingredient_ids || []).map(Number))];
  const dietIds = [...new Set((body.diet_type_ids || []).map(Number))];
  const allergenIds = [...new Set((body.allergen_group_ids || []).map(Number))];
  const dislikedIds = [...new Set((body.disliked_ingredient_ids || []).map(Number))];

  // Luồng 5a: nguyên liệu vừa thích vừa không thích
  const conflicts = likedIds.filter((id) => dislikedIds.includes(id));
  if (conflicts.length > 0) {
    return sendError(res, 422, 'PROFILE_CONFLICT', 'Nguyên liệu không thể vừa nằm trong danh sách yêu thích vừa trong danh sách không thích.', [
      { field: 'taste_prefs.liked_ingredient_ids', code: 'CONFLICT', message: `Trùng với disliked_ingredient_ids: ${conflicts.join(', ')}` },
      { field: 'disliked_ingredient_ids', code: 'CONFLICT', message: `Trùng với taste_prefs.liked_ingredient_ids: ${conflicts.join(', ')}` },
    ]);
  }

  const [missingDiets, missingAllergens, missingIngs] = await Promise.all([
    findMissingIds('diet_types', dietIds),
    findMissingIds('allergen_groups', allergenIds),
    findMissingIds('ingredients', [...new Set([...likedIds, ...dislikedIds])]),
  ]);
  const idErrors = [];
  if (missingDiets.length) idErrors.push({ field: 'diet_type_ids', code: 'NOT_FOUND', message: `Không tồn tại: ${missingDiets.join(', ')}` });
  if (missingAllergens.length) idErrors.push({ field: 'allergen_group_ids', code: 'NOT_FOUND', message: `Không tồn tại: ${missingAllergens.join(', ')}` });
  if (missingIngs.length) idErrors.push({ field: 'ingredient_ids', code: 'NOT_FOUND', message: `Nguyên liệu không tồn tại: ${missingIngs.join(', ')}` });
  if (idErrors.length) return sendError(res, 422, 'VALIDATION_ERROR', 'Có id không tồn tại.', idErrors);

  // Ghi đè toàn bộ: trường không gửi được đặt về rỗng/null
  const tastePrefs = { liked_ingredient_ids: likedIds };
  for (const k of LEVEL_KEYS) if (Number.isInteger(prefs[k])) tastePrefs[k] = prefs[k];

  try {
    const { error: upsertErr } = await supabaseAdmin.from('user_profiles').upsert({
      user_id: userId,
      taste_prefs: tastePrefs,
      calorie_goal: body.calorie_goal ?? null,
      budget_min: body.budget_min ?? null,
      budget_max: body.budget_max ?? null,
      household_size: body.household_size ?? 1,
    }, { onConflict: 'user_id' });
    if (upsertErr) throw upsertErr;

    await Promise.all([
      replaceLinks('user_diets', 'diet_type_id', userId, dietIds),
      replaceLinks('user_allergies', 'allergen_group_id', userId, allergenIds),
      replaceLinks('user_disliked_ingredients', 'ingredient_id', userId, dislikedIds),
    ]);
  } catch (err) {
    console.error('[TasteProfile] Lỗi khi lưu hồ sơ:', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Lỗi khi lưu hồ sơ khẩu vị. Vui lòng thử lại.');
  }

  // Tính lại profile_vector, taste_vector ngay sau khi lưu và xóa bộ nhớ đệm gợi ý
  try {
    await recomputeUserVectors(userId);
  } catch (err) {
    console.warn('[TasteProfile] Chưa tính lại được véc-tơ khẩu vị:', err.message);
  }
  invalidateRecommendationCache(userId);

  return sendOk(res, await fetchTasteProfile(userId));
}

/**
 * 4.5.2 Lưu hồ sơ khẩu vị (ghi đè toàn bộ) – PUT /me/taste-profile
 */
export async function updateTasteProfile(req, res) {
  return saveTasteProfile(req, res, req.body || {});
}

/**
 * 5.3.1 Cập nhật một phần hồ sơ khẩu vị – PATCH /me/taste-profile
 */
export async function patchTasteProfile(req, res) {
  const body = req.body || {};
  const current = await fetchTasteProfile(req.user.id);
  const pick = (key) => (body[key] !== undefined ? body[key] : current[key]);
  return saveTasteProfile(req, res, {
    taste_prefs: { ...current.taste_prefs, ...(body.taste_prefs || {}) },
    calorie_goal: pick('calorie_goal'),
    household_size: pick('household_size'),
    budget_min: pick('budget_min'),
    budget_max: pick('budget_max'),
    diet_type_ids: pick('diet_type_ids'),
    allergen_group_ids: pick('allergen_group_ids'),
    disliked_ingredient_ids: pick('disliked_ingredient_ids'),
  });
}
