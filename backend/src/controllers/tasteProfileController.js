// src/controllers/tasteProfileController.js
// Xử lý Hồ sơ khẩu vị người dùng theo mục 4.5 và 5.3.1 của tài liệu đặc tả API

import { supabaseAdmin } from '../config/supabase.js';
import { invalidateRecommendationCache } from '../services/recommendationService.js';

/**
 * Tính phần trăm hoàn thiện hồ sơ khẩu vị (0 - 100)
 */
function calculateCompleteness({
  taste_prefs,
  calorie_goal,
  budget_min,
  budget_max,
  household_size,
  diet_type_ids,
  allergen_group_ids,
}) {
  let score = 0;

  if (taste_prefs && typeof taste_prefs === 'object') {
    let tastePoints = 0;
    if (typeof taste_prefs.spicy_level === 'number') tastePoints += 5;
    if (typeof taste_prefs.salty_level === 'number') tastePoints += 5;
    if (typeof taste_prefs.sweet_level === 'number') tastePoints += 5;
    if (typeof taste_prefs.sour_level === 'number') tastePoints += 5;
    score += tastePoints;
  }

  if (Array.isArray(diet_type_ids) && diet_type_ids.length > 0) score += 15;
  if (Array.isArray(allergen_group_ids) && allergen_group_ids.length > 0) score += 15;
  if (calorie_goal && Number(calorie_goal) > 0) score += 15;
  if (budget_min !== null && budget_max !== null && Number(budget_max) > 0) score += 15;
  if (household_size && Number(household_size) > 0) score += 20;

  return Math.min(100, Math.max(0, score));
}

/**
 * Lấy toàn bộ thông tin chi tiết của một taste profile đã được gắn kèm tên tra cứu
 */
async function fetchFullTasteProfile(userId) {
  // 1. Lấy dòng trong user_profiles
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr) {
    throw profileErr;
  }

  if (!profile) {
    // Chưa có dữ liệu: trả các trường rỗng và completeness = 0
    return {
      preferred_region_id: null,
      taste_prefs: {
        spicy_level: 0,
        salty_level: 0,
        sweet_level: 0,
        sour_level: 0,
        liked_ingredient_ids: [],
      },
      calorie_goal: null,
      budget_min: null,
      budget_max: null,
      household_size: 1,
      diet_type_ids: [],
      allergen_group_ids: [],
      disliked_ingredient_ids: [],
      preferred_region: null,
      diet_types: [],
      allergen_groups: [],
      disliked_ingredients: [],
      completeness: 0,
      updated_at: null,
    };
  }

  // 2. Lấy user_diets, user_allergies, user_disliked_ingredients
  const [
    { data: dietsData },
    { data: allergiesData },
    { data: dislikesData },
  ] = await Promise.all([
    supabaseAdmin.from('user_diets').select('diet_type_id').eq('user_id', userId),
    supabaseAdmin.from('user_allergies').select('allergen_group_id').eq('user_id', userId),
    supabaseAdmin.from('user_disliked_ingredients').select('ingredient_id').eq('user_id', userId),
  ]);

  const dietTypeIds = (dietsData || []).map((d) => d.diet_type_id);
  const allergenGroupIds = (allergiesData || []).map((a) => a.allergen_group_id);
  const dislikedIngredientIds = (dislikesData || []).map((i) => i.ingredient_id);

  // 3. Tra cứu thông tin chi tiết (tên hiển thị)
  const queries = [];

  // Chế độ ăn
  if (dietTypeIds.length > 0) {
    queries.push(
      supabaseAdmin.from('diet_types').select('id, name').in('id', dietTypeIds)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Nhóm dị ứng
  if (allergenGroupIds.length > 0) {
    queries.push(
      supabaseAdmin.from('allergen_groups').select('id, name').in('id', allergenGroupIds)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  // Nguyên liệu kiêng
  if (dislikedIngredientIds.length > 0) {
    queries.push(
      supabaseAdmin.from('ingredients').select('id, name').in('id', dislikedIngredientIds)
    );
  } else {
    queries.push(Promise.resolve({ data: [] }));
  }

  const [dietsRes, allergiesRes, dislikesRes] = await Promise.all(queries);

  const tastePrefs = profile.taste_prefs || {};
  const completeness = calculateCompleteness({
    taste_prefs: tastePrefs,
    calorie_goal: profile.calorie_goal,
    budget_min: profile.budget_min,
    budget_max: profile.budget_max,
    household_size: profile.household_size,
    diet_type_ids: dietTypeIds,
    allergen_group_ids: allergenGroupIds,
  });

  return {
    preferred_region_id: profile.preferred_region_id,
    taste_prefs: {
      spicy_level: tastePrefs.spicy_level ?? 0,
      salty_level: tastePrefs.salty_level ?? 0,
      sweet_level: tastePrefs.sweet_level ?? 0,
      sour_level: tastePrefs.sour_level ?? 0,
      liked_ingredient_ids: tastePrefs.liked_ingredient_ids ?? [],
    },
    calorie_goal: profile.calorie_goal !== null ? Number(profile.calorie_goal) : null,
    budget_min: profile.budget_min !== null ? Number(profile.budget_min) : null,
    budget_max: profile.budget_max !== null ? Number(profile.budget_max) : null,
    household_size: profile.household_size ?? 1,
    diet_type_ids: dietTypeIds,
    allergen_group_ids: allergenGroupIds,
    disliked_ingredient_ids: dislikedIngredientIds,
    preferred_region: null,
    diet_types: dietsRes?.data || [],
    allergen_groups: allergiesRes?.data || [],
    disliked_ingredients: dislikesRes?.data || [],
    completeness,
    updated_at: profile.updated_at,
  };
}

/**
 * 4.5.1 Xem hồ sơ khẩu vị
 * GET /me/taste-profile hoặc /api/me/taste-profile
 */
export async function getTasteProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const data = await fetchFullTasteProfile(userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.5.2 Lưu hồ sơ khẩu vị (ghi đè toàn bộ)
 * PUT /me/taste-profile hoặc /api/me/taste-profile
 */
export async function updateTasteProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const body = req.body || {};

    const {
      preferred_region_id,
      taste_prefs = {},
      calorie_goal,
      budget_min,
      budget_max,
      household_size = 1,
      diet_type_ids = [],
      allergen_group_ids = [],
      disliked_ingredient_ids = [],
    } = body;

    // ── 1. Kiểm tra miền giá trị mức độ vị (0–5) ─────────────────────────────
    const levels = ['spicy_level', 'salty_level', 'sweet_level', 'sour_level'];
    for (const lvl of levels) {
      if (taste_prefs[lvl] !== undefined && taste_prefs[lvl] !== null) {
        const val = Number(taste_prefs[lvl]);
        if (!Number.isInteger(val) || val < 0 || val > 5) {
          return res.status(422).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Mức độ vị ${lvl} phải là số nguyên trong khoảng 0 đến 5.`,
            },
          });
        }
      }
    }

    // ── 2. Kiểm tra mâu thuẫn nghiệp vụ (PROFILE_CONFLICT) ───────────────────
    // 2.1: budget_min > budget_max
    if (
      budget_min !== undefined &&
      budget_min !== null &&
      budget_max !== undefined &&
      budget_max !== null
    ) {
      const minB = Number(budget_min);
      const maxB = Number(budget_max);
      if (minB > maxB) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'PROFILE_CONFLICT',
            message: 'Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.',
            details: {
              fields: ['budget_min', 'budget_max'],
            },
          },
        });
      }
    }

    // 2.2: Nguyên liệu vừa nằm trong liked_ingredient_ids vừa trong disliked_ingredient_ids
    const likedIds = Array.isArray(taste_prefs.liked_ingredient_ids)
      ? taste_prefs.liked_ingredient_ids.map(Number)
      : [];
    const dislikedIds = Array.isArray(disliked_ingredient_ids)
      ? disliked_ingredient_ids.map(Number)
      : [];

    const conflictingIngredientIds = likedIds.filter((id) => dislikedIds.includes(id));
    if (conflictingIngredientIds.length > 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PROFILE_CONFLICT',
          message: 'Nguyên liệu không thể vừa nằm trong danh sách yêu thích vừa trong danh sách kiêng.',
          details: {
            fields: ['taste_prefs.liked_ingredient_ids', 'disliked_ingredient_ids'],
            conflicting_ingredient_ids: conflictingIngredientIds,
          },
        },
      });
    }

    // ── 3. Validate tính tồn tại của các id tham chiếu ───────────────────────
    // 3.1: diet_type_ids
    if (Array.isArray(diet_type_ids) && diet_type_ids.length > 0) {
      const { data: diets } = await supabaseAdmin
        .from('diet_types')
        .select('id')
        .in('id', diet_type_ids);

      const foundDietIds = (diets || []).map((d) => d.id);
      const invalidDietIds = diet_type_ids.filter((id) => !foundDietIds.includes(Number(id)));
      if (invalidDietIds.length > 0) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Chế độ ăn với id [${invalidDietIds.join(', ')}] không tồn tại.`,
          },
        });
      }
    }

    // 3.3: allergen_group_ids
    if (Array.isArray(allergen_group_ids) && allergen_group_ids.length > 0) {
      const { data: allergens } = await supabaseAdmin
        .from('allergen_groups')
        .select('id')
        .in('id', allergen_group_ids);

      const foundAllergenIds = (allergens || []).map((a) => a.id);
      const invalidAllergenIds = allergen_group_ids.filter((id) => !foundAllergenIds.includes(Number(id)));
      if (invalidAllergenIds.length > 0) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Nhóm dị ứng với id [${invalidAllergenIds.join(', ')}] không tồn tại.`,
          },
        });
      }
    }

    // 3.4: liked_ingredient_ids & disliked_ingredient_ids
    const allIngredientIdsToCheck = Array.from(new Set([...likedIds, ...dislikedIds]));
    if (allIngredientIdsToCheck.length > 0) {
      const { data: ingRows } = await supabaseAdmin
        .from('ingredients')
        .select('id')
        .in('id', allIngredientIdsToCheck);

      const foundIngIds = (ingRows || []).map((i) => Number(i.id));
      const invalidIngIds = allIngredientIdsToCheck.filter((id) => !foundIngIds.includes(id));
      if (invalidIngIds.length > 0) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Nguyên liệu với id [${invalidIngIds.join(', ')}] không tồn tại.`,
          },
        });
      }
    }

    // ── 4. Lưu dữ liệu (ghi đè toàn bộ) ──────────────────────────────────────
    const cleanTastePrefs = {
      spicy_level: taste_prefs.spicy_level !== undefined ? Number(taste_prefs.spicy_level) : 0,
      salty_level: taste_prefs.salty_level !== undefined ? Number(taste_prefs.salty_level) : 0,
      sweet_level: taste_prefs.sweet_level !== undefined ? Number(taste_prefs.sweet_level) : 0,
      sour_level: taste_prefs.sour_level !== undefined ? Number(taste_prefs.sour_level) : 0,
      liked_ingredient_ids: likedIds,
    };

    // 4.1 Upsert user_profiles
    const { error: upsertErr } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: userId,
        preferred_region_id: preferred_region_id || null,
        taste_prefs: cleanTastePrefs,
        calorie_goal: calorie_goal !== undefined && calorie_goal !== null ? Number(calorie_goal) : null,
        budget_min: budget_min !== undefined && budget_min !== null ? Number(budget_min) : null,
        budget_max: budget_max !== undefined && budget_max !== null ? Number(budget_max) : null,
        household_size: household_size ? Math.max(1, Number(household_size)) : 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('Save user_profiles error:', upsertErr);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lỗi khi lưu thông tin hồ sơ khẩu vị. Vui lòng thử lại.',
        },
      });
    }

    // 4.2 Cập nhật user_diets
    await supabaseAdmin.from('user_diets').delete().eq('user_id', userId);
    if (Array.isArray(diet_type_ids) && diet_type_ids.length > 0) {
      const dietInserts = diet_type_ids.map((id) => ({
        user_id: userId,
        diet_type_id: Number(id),
      }));
      await supabaseAdmin.from('user_diets').insert(dietInserts);
    }

    // 4.3 Cập nhật user_allergies
    await supabaseAdmin.from('user_allergies').delete().eq('user_id', userId);
    if (Array.isArray(allergen_group_ids) && allergen_group_ids.length > 0) {
      const allergyInserts = allergen_group_ids.map((id) => ({
        user_id: userId,
        allergen_group_id: Number(id),
      }));
      await supabaseAdmin.from('user_allergies').insert(allergyInserts);
    }

    // 4.4 Cập nhật user_disliked_ingredients
    await supabaseAdmin.from('user_disliked_ingredients').delete().eq('user_id', userId);
    if (Array.isArray(disliked_ingredient_ids) && disliked_ingredient_ids.length > 0) {
      const dislikeInserts = disliked_ingredient_ids.map((id) => ({
        user_id: userId,
        ingredient_id: Number(id),
      }));
      await supabaseAdmin.from('user_disliked_ingredients').insert(dislikeInserts);
    }

    // ── 5. Trả về hồ sơ khẩu vị đầy đủ mới nhất ──────────────────────────────
    const fullProfile = await fetchFullTasteProfile(userId);

    // Hủy cache gợi ý cá nhân hóa vì hồ sơ khẩu vị đã thay đổi (Quy tắc 3 mục 4.7.1)
    invalidateRecommendationCache(userId);

    return res.status(200).json({
      success: true,
      data: fullProfile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5.3.1 Cập nhật một phần hồ sơ khẩu vị
 * PATCH /me/taste-profile hoặc /api/me/taste-profile
 */
export async function patchTasteProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const body = req.body || {};

    // Lấy hồ sơ hiện tại để merge
    const current = await fetchFullTasteProfile(userId);

    const mergedBody = {
      preferred_region_id: body.preferred_region_id !== undefined ? body.preferred_region_id : current.preferred_region_id,
      taste_prefs: {
        ...current.taste_prefs,
        ...(body.taste_prefs || {}),
      },
      calorie_goal: body.calorie_goal !== undefined ? body.calorie_goal : current.calorie_goal,
      budget_min: body.budget_min !== undefined ? body.budget_min : current.budget_min,
      budget_max: body.budget_max !== undefined ? body.budget_max : current.budget_max,
      household_size: body.household_size !== undefined ? body.household_size : current.household_size,
      diet_type_ids: body.diet_type_ids !== undefined ? body.diet_type_ids : current.diet_type_ids,
      allergen_group_ids: body.allergen_group_ids !== undefined ? body.allergen_group_ids : current.allergen_group_ids,
      disliked_ingredient_ids: body.disliked_ingredient_ids !== undefined ? body.disliked_ingredient_ids : current.disliked_ingredient_ids,
    };

    req.body = mergedBody;
    return updateTasteProfile(req, res, next);
  } catch (err) {
    next(err);
  }
}
