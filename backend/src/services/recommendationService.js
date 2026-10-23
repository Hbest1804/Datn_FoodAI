// src/services/recommendationService.js
// Xử lý Gợi ý cá nhân hóa món ăn theo mục 4.7 của tài liệu đặc tả API

import { supabaseAdmin } from '../config/supabase.js';

// Cache in-memory theo userId với thời gian sống 10 phút (TTL 600,000ms)
const recommendationCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Xóa cache gợi ý của một người dùng khi hồ sơ, yêu thích hoặc đánh giá thay đổi
 * Quy tắc 3 mục 4.7.1
 * @param {string} userId - UUID của người dùng
 */
export function invalidateRecommendationCache(userId) {
  if (userId) {
    recommendationCache.delete(userId);
  }
}

/**
 * Xóa toàn bộ cache (nếu cần quản trị)
 */
export function clearAllRecommendationCache() {
  recommendationCache.clear();
}

/**
 * Tính phần trăm hoàn thiện hồ sơ khẩu vị
 */
function calculateProfileCompleteness(profile, dietIds, allergyIds) {
  let score = 0;
  if (profile?.taste_prefs && typeof profile.taste_prefs === 'object') {
    let tScore = 0;
    if (typeof profile.taste_prefs.spicy_level === 'number') tScore += 5;
    if (typeof profile.taste_prefs.salty_level === 'number') tScore += 5;
    if (typeof profile.taste_prefs.sweet_level === 'number') tScore += 5;
    if (typeof profile.taste_prefs.sour_level === 'number') tScore += 5;
    score += tScore;
  }
  if (Array.isArray(dietIds) && dietIds.length > 0) score += 15;
  if (Array.isArray(allergyIds) && allergyIds.length > 0) score += 15;
  if (profile?.calorie_goal && Number(profile.calorie_goal) > 0) score += 15;
  if (profile?.budget_max && Number(profile.budget_max) > 0) score += 15;
  if (profile?.household_size && Number(profile.household_size) > 0) score += 20;
  return Math.min(100, Math.max(0, score));
}

/**
 * Lấy danh sách gợi ý cá nhân hóa cho người dùng
 * GET /me/recommendations
 */
export async function getPersonalizedRecommendations({
  userId,
  limit = 12,
  categoryId,
  regionId,
  refresh = false,
}) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));

  // 1. Kiểm tra cache nếu không yêu cầu refresh
  const cacheKey = userId ? `${userId}` : `guest_${categoryId || 'all'}`;
  if (!refresh && recommendationCache.has(cacheKey)) {
    const cached = recommendationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Áp dụng bộ lọc category_id trên kết quả cache
      let filtered = cached.data;
      if (categoryId) {
        filtered = filtered.filter((item) => item.dish.category?.id === Number(categoryId));
      }
      return {
        success: true,
        data: filtered.slice(0, safeLimit),
        meta: {
          ...cached.meta,
          cached: true,
        },
      };
    }
  }

  // 2. Tải hồ sơ và lịch sử tương tác của người dùng (nếu có userId)
  let userProfile = null;
  let dietTypeIds = [];
  let dietNames = [];
  let allergenGroupIds = [];
  let dislikedIngredientIds = [];
  let userFavSet = new Set();
  let userRatingsMap = new Map();
  let userViewsMap = new Map();
  let completeness = 0;
  let isNewUser = true;
  let strategy = 'popular_fallback';
  let promptCompleteProfile = true;

  if (userId) {
    const [
      profileRes,
      dietsRes,
      allergiesRes,
      dislikesRes,
      userFavsRes,
      userRatingsRes,
      userViewsRes,
    ] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_diets').select('diet_type_id, diet_types(id, name)').eq('user_id', userId),
      supabaseAdmin.from('user_allergies').select('allergen_group_id, allergen_groups(id, name)').eq('user_id', userId),
      supabaseAdmin.from('user_disliked_ingredients').select('ingredient_id, ingredients(id, name)').eq('user_id', userId),
      supabaseAdmin.from('favorites').select('dish_id').eq('user_id', userId),
      supabaseAdmin.from('ratings').select('dish_id, stars').eq('user_id', userId),
      supabaseAdmin.from('view_history').select('dish_id, view_count').eq('user_id', userId),
    ]);

    userProfile = profileRes.data || null;
    dietTypeIds = (dietsRes.data || []).map((d) => d.diet_type_id).filter(Boolean);
    dietNames = (dietsRes.data || []).map((d) => d.diet_types?.name).filter(Boolean);
    allergenGroupIds = (allergiesRes.data || []).map((a) => a.allergen_group_id).filter(Boolean);
    dislikedIngredientIds = (dislikesRes.data || []).map((i) => i.ingredient_id).filter(Boolean);

    userFavSet = new Set((userFavsRes.data || []).map((f) => f.dish_id));
    userRatingsMap = new Map((userRatingsRes.data || []).map((r) => [r.dish_id, r.stars]));
    userViewsMap = new Map((userViewsRes.data || []).map((v) => [v.dish_id, v.view_count]));

    completeness = calculateProfileCompleteness(userProfile, dietTypeIds, allergenGroupIds);
    const hasInteraction = userFavSet.size > 0 || userRatingsMap.size > 0 || userViewsMap.size > 0;
    isNewUser = completeness < 30 && !hasInteraction;
    strategy = isNewUser ? 'popular_fallback' : 'personalized';
    promptCompleteProfile = completeness < 50;
  }

  // 3. Tải danh sách món ăn từ database
  let dishesQuery = supabaseAdmin
    .from('dishes')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      category,
      category_normalized,
      cook_time_minutes,
      difficulty,
      servings,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      is_published,
      created_at,
      dish_ingredients (
        ingredient_id,
        is_optional,
        ingredients (id, name, allergen_group_id)
      ),
      dish_tags (
        tag_id,
        tags (id, name)
      )
    `)
    .eq('is_published', true);

  if (categoryId) {
    const { data: cat } = await supabaseAdmin.from('categories').select('name').eq('id', Number(categoryId)).maybeSingle();
    if (cat) {
      dishesQuery = dishesQuery.eq('category', cat.name);
    }
  }

  const { data: rawDishes, error: dishesErr } = await dishesQuery;
  if (dishesErr) throw dishesErr;

  const allDishes = rawDishes || [];
  const dishIds = allDishes.map((d) => d.id);

  // 4. Lấy toàn bộ ratings và favorites của các món để tính avg_rating, favorite_count
  const [allRatingsRes, allFavsRes] = await Promise.all([
    dishIds.length > 0
      ? supabaseAdmin.from('ratings').select('dish_id, stars').in('dish_id', dishIds)
      : { data: [] },
    dishIds.length > 0
      ? supabaseAdmin.from('favorites').select('dish_id').in('dish_id', dishIds)
      : { data: [] },
  ]);

  const ratingsStats = new Map();
  (allRatingsRes.data || []).forEach((r) => {
    if (!ratingsStats.has(r.dish_id)) {
      ratingsStats.set(r.dish_id, { count: 0, sum: 0 });
    }
    const stat = ratingsStats.get(r.dish_id);
    stat.count += 1;
    stat.sum += r.stars;
  });

  const favsCounts = new Map();
  (allFavsRes.data || []).forEach((f) => {
    favsCounts.set(f.dish_id, (favsCounts.get(f.dish_id) || 0) + 1);
  });

  // 5. Loại trừ món chứa nguyên liệu thuộc nhóm dị ứng và nguyên liệu không thích (Quy tắc nghiệp vụ 4.7.1)
  const safeDishes = allDishes.filter((dish) => {
    const dishIngredients = dish.dish_ingredients || [];

    for (const di of dishIngredients) {
      const ing = di.ingredients;
      if (!ing) continue;

      // Kiểm tra dị ứng
      if (ing.allergen_group_id && allergenGroupIds.includes(ing.allergen_group_id)) {
        return false;
      }
      // Kiểm tra nguyên liệu không thích
      if (dislikedIngredientIds.includes(ing.id)) {
        return false;
      }
    }
    return true;
  });

  // 6. Xếp hạng và tạo lý do (reasons) cho từng món
  const scoredItems = safeDishes.map((dish) => {
    const rStat = ratingsStats.get(dish.id) || { count: 0, sum: 0 };
    const avgRating = rStat.count > 0 ? Math.round((rStat.sum / rStat.count) * 10) / 10 : 5.0;
    const ratingCount = rStat.count;
    const favoriteCount = favsCounts.get(dish.id) || 0;
    const isFavorite = userFavSet.has(dish.id);

    const dishTags = (dish.dish_tags || []).map((t) => t.tags?.name).filter(Boolean);
    const dishIngIds = (dish.dish_ingredients || []).map((di) => di.ingredients?.id).filter(Boolean);

    let score = 50;
    const reasons = [];

    if (strategy === 'popular_fallback') {
      // Điểm dựa vào độ phổ biến và đánh giá cộng đồng
      score = Math.min(96, Math.max(70, Math.round(avgRating * 17 + Math.min(favoriteCount * 2, 12))));
      reasons.push(`Được nhiều người đánh giá cao (⭐ ${avgRating}/5)`);
      if (favoriteCount > 0) {
        reasons.push(`Hơn ${favoriteCount} lượt yêu thích từ cộng đồng`);
      }
      if (dish.cook_time_minutes && dish.cook_time_minutes <= 25) {
        reasons.push(`Nấu nhanh gọn chỉ ${dish.cook_time_minutes} phút`);
      }
      if (reasons.length === 1) {
        reasons.push('Món ăn tiêu biểu được chọn lọc dành cho thành viên mới');
      }
    } else {
      // ── Cá nhân hóa chuyên sâu ──
      // a. Chế độ ăn
      if (dietNames.length > 0) {
        let dietMatched = false;
        for (const dName of dietNames) {
          if (dName.toLowerCase().includes('chay') && dishTags.some((t) => t.toLowerCase().includes('chay'))) {
            score += 20;
            reasons.push('Phù hợp hoàn hảo với chế độ Ăn chay');
            dietMatched = true;
            break;
          }
          if (dName.toLowerCase().includes('eat clean') || dName.toLowerCase().includes('lành mạnh')) {
            if (dishTags.some((t) => t.includes('Thanh đạm') || t.includes('Bổ dưỡng')) || (dish.calories && dish.calories <= 500)) {
              score += 20;
              reasons.push('Đáp ứng tiêu chí Ăn lành mạnh / Eat Clean');
              dietMatched = true;
              break;
            }
          }
          if (dName.toLowerCase().includes('keto') && dish.carbs_g !== null && dish.carbs_g <= 15) {
            score += 20;
            reasons.push('Hàm lượng tinh bột cực thấp, tối ưu cho Keto');
            dietMatched = true;
            break;
          }
          if (dName.toLowerCase().includes('low-carb') && dish.carbs_g !== null && dish.carbs_g <= 30) {
            score += 20;
            reasons.push('Ít tinh bột, thích hợp chế độ Low-Carb');
            dietMatched = true;
            break;
          }
        }
        if (!dietMatched) {
          score += 10;
          reasons.push(`Tương thích với chế độ ăn ${dietNames[0]}`);
        }
      }

      // c. Mục tiêu calo mỗi bữa
      if (userProfile?.calorie_goal && dish.calories) {
        const mealTarget = Math.round(Number(userProfile.calorie_goal) / 3);
        const diff = Math.abs(dish.calories - mealTarget);
        if (diff <= 120) {
          score += 15;
          reasons.push(`Cân đối dinh dưỡng (~${dish.calories} kcal, tối ưu mức mục tiêu ${userProfile.calorie_goal} kcal/ngày)`);
        }
      }

      // d. Khẩu vị nguyên liệu yêu thích & độ cay
      const likedIngIds = userProfile?.taste_prefs?.liked_ingredient_ids;
      if (Array.isArray(likedIngIds) && likedIngIds.some((id) => dishIngIds.includes(id))) {
        score += 15;
        reasons.push('Chứa nguyên liệu nằm trong danh sách yêu thích của bạn');
      }

      const userSpicyLevel = userProfile?.taste_prefs?.spicy_level;
      if (typeof userSpicyLevel === 'number') {
        const hasSpicyTag = dishTags.some((t) => t.toLowerCase().includes('cay'));
        if (userSpicyLevel === 0 && hasSpicyTag) {
          score -= 15;
        } else if (userSpicyLevel >= 2 && hasSpicyTag) {
          score += 10;
          reasons.push('Vị cay hấp dẫn đúng sở thích khẩu vị');
        }
      }

      // e. Lịch sử yêu thích & đánh giá trước đây
      if (isFavorite) {
        score += 12;
        reasons.push('Món ăn đã được bạn lưu trong danh sách yêu thích');
      }

      const userRating = userRatingsMap.get(dish.id);
      if (userRating && userRating >= 4) {
        score += 15;
        reasons.push(`Bạn từng cho món này ${userRating} sao`);
      }

      const views = userViewsMap.get(dish.id);
      if (views && views >= 2) {
        score += 8;
        reasons.push('Món bạn thường xuyên quan tâm tìm hiểu');
      }

      // f. Đánh giá cộng đồng & thời gian nấu
      if (avgRating >= 4.6 && ratingCount >= 2) {
        score += 8;
        reasons.push(`Được nhiều người đánh giá rất cao (⭐ ${avgRating}/5)`);
      }
      if (dish.cook_time_minutes && dish.cook_time_minutes <= 25) {
        score += 5;
        reasons.push(`Thời gian nấu nhanh chỉ ${dish.cook_time_minutes} phút`);
      }

      if (reasons.length === 0) {
        reasons.push('Món ăn thanh lành giàu dinh dưỡng phù hợp cho bữa cơm');
      }

      // Giới hạn điểm số từ 60 đến 99
      score = Math.min(99, Math.max(60, score));
    }

    return {
      dish: {
        id: dish.id,
        name: dish.name,
        slug: dish.slug,
        description: dish.description,
        image_url: dish.image_url,
        category: typeof dish.category === 'object' ? dish.category : (dish.category ? { name: dish.category } : null),
        cook_time_minutes: dish.cook_time_minutes,
        difficulty: dish.difficulty,
        calories: dish.calories,
        avg_rating: avgRating,
        rating_count: ratingCount,
        favorite_count: favoriteCount,
        is_favorite: isFavorite,
      },
      score,
      reasons: reasons.slice(0, 3), // Lấy tối đa 3 lý do nổi bật nhất
    };
  });

  // 7. Sắp xếp món theo điểm số giảm dần, sau đó theo avg_rating và favorite_count
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.dish.avg_rating !== a.dish.avg_rating) return b.dish.avg_rating - a.dish.avg_rating;
    return b.dish.favorite_count - a.dish.favorite_count;
  });

  const generatedAt = new Date().toISOString();
  const meta = {
    strategy,
    profile_completeness: completeness,
    prompt_complete_profile: promptCompleteProfile,
    generated_at: generatedAt,
  };

  // Lưu vào cache 10 phút (lưu toàn bộ danh sách đã tính)
  recommendationCache.set(cacheKey, {
    data: scoredItems,
    meta,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return {
    success: true,
    data: scoredItems.slice(0, safeLimit),
    meta,
  };
}
