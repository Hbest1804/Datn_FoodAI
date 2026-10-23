// src/controllers/dishesController.js
//   4.3.1 Tìm kiếm & lọc món ăn (GET /dishes)
//   4.3.2 Xem chi tiết món ăn & công thức (GET /dishes/:idOrSlug)
//   5.1.1 Món phổ biến / nổi bật (GET /dishes/popular)

import { supabaseAdmin } from '../config/supabase.js';
import { matchesSearchKeyword, normalizeText } from '../utils/textUtils.js';
import {
  ApiError,
  UUID_REGEX,
  pageMeta,
  parseIdList,
  parsePagination,
  sendError,
  sendOk,
} from '../utils/http.js';
import { toDishSummary } from '../services/recommendationService.js';
import { recomputeUserVectorsInBackground } from '../services/embeddingService.js';

const SORTS = ['relevance', 'match', 'newest', 'rating', 'popular', 'cook_time', 'calories'];

function parseNonNegative(query, key) {
  if (query[key] === undefined || query[key] === '') return undefined;
  const n = Number(query[key]);
  if (!Number.isFinite(n) || n < 0) throw new ApiError(400, 'INVALID_QUERY', `Tham số ${key} không hợp lệ.`);
  return n;
}

async function getUserFavoriteSet(userId, dishIds) {
  if (!userId || dishIds.length === 0) return new Set();
  const { data } = await supabaseAdmin.from('favorites').select('dish_id').eq('user_id', userId).in('dish_id', dishIds);
  return new Set((data || []).map((f) => f.dish_id));
}

function logInteraction(row) {
  supabaseAdmin.from('interaction_logs').insert(row).then(({ error }) => {
    if (error) console.warn('[Interaction] Không ghi được interaction_logs:', error.message);
  });
}

/**
 * 4.3.1 Tìm kiếm & lọc món ăn – GET /dishes
 */
export async function getDishes(req, res) {
  const q = req.query;
  const keyword = typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '';
  const ingredientIds = parseIdList(q.ingredient_ids, 'ingredient_ids');
  const excludeIds = parseIdList(q.exclude_ingredient_ids, 'exclude_ingredient_ids');
  const tagIds = parseIdList(q.tag_ids, 'tag_ids');
  const ingredientMatch = q.ingredient_match ?? 'any';
  if (!['any', 'all'].includes(ingredientMatch)) throw new ApiError(400, 'INVALID_QUERY', 'ingredient_match phải là any hoặc all.');
  const minMatchRatio = parseNonNegative(q, 'min_match_ratio');
  if (minMatchRatio !== undefined && minMatchRatio > 1) throw new ApiError(400, 'INVALID_QUERY', 'min_match_ratio nằm trong khoảng 0–1.');
  if (q.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(q.difficulty)) {
    throw new ApiError(400, 'INVALID_QUERY', 'difficulty phải là easy, medium hoặc hard.');
  }
  if (q.sort !== undefined && !SORTS.includes(q.sort)) throw new ApiError(400, 'INVALID_QUERY', 'Giá trị sort không hợp lệ.');
  const maxCookTime = parseNonNegative(q, 'max_cook_time');
  const maxCalories = parseNonNegative(q, 'max_calories');
  const minProtein = parseNonNegative(q, 'min_protein_g');
  const maxCarbs = parseNonNegative(q, 'max_carbs_g');
  const maxFat = parseNonNegative(q, 'max_fat_g');
  const pg = parsePagination(q);

  // 1. Các điều kiện lọc thực hiện ngay trong truy vấn CSDL
  let query = supabaseAdmin
    .from('dishes')
    .select(`id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories,
      avg_rating, rating_count, favorite_count, created_at,
      dish_tags(tag_id),
      dish_ingredients(is_optional, ingredient:ingredients(id, name, aliases))`)
    .eq('is_published', true);
  if (typeof q.category === 'string' && q.category.trim()) query = query.eq('category_normalized', normalizeText(q.category));
  if (q.difficulty) query = query.eq('difficulty', q.difficulty);
  if (maxCookTime !== undefined) query = query.lte('cook_time_minutes', maxCookTime);
  if (maxCalories !== undefined) query = query.lte('calories', maxCalories);
  if (minProtein !== undefined) query = query.gte('protein_g', minProtein);
  if (maxCarbs !== undefined) query = query.lte('carbs_g', maxCarbs);
  if (maxFat !== undefined) query = query.lte('fat_g', maxFat);
  const { data: rows, error } = await query;
  if (error) throw error;

  // 2. Lọc thẻ, nguyên liệu và từ khóa (bỏ dấu) trên kết quả
  const pantry = new Set(ingredientIds || []);
  let list = (rows || []).filter((d) => {
    const ings = d.dish_ingredients || [];
    const ingIds = ings.map((di) => Number(di.ingredient?.id));
    const dishTagIds = (d.dish_tags || []).map((t) => t.tag_id);
    if (tagIds && !tagIds.every((t) => dishTagIds.includes(t))) return false;
    if (excludeIds && ingIds.some((id) => excludeIds.includes(id))) return false;
    if (ingredientIds) {
      const hits = ingIds.filter((id) => pantry.has(id)).length;
      if (ingredientMatch === 'all' ? !ingredientIds.every((id) => ingIds.includes(id)) : hits === 0) return false;
    }
    if (keyword) {
      const inText = matchesSearchKeyword(d.name, keyword) || matchesSearchKeyword(d.description, keyword);
      const inIngredients = ings.some((di) =>
        matchesSearchKeyword(di.ingredient?.name, keyword)
        || (di.ingredient?.aliases || []).some((a) => matchesSearchKeyword(a, keyword)));
      if (!inText && !inIngredients) return false;
    }
    return true;
  });

  // 3. Độ khớp nguyên liệu có sẵn (nguyên liệu is_optional không tính là thiếu)
  if (ingredientIds) {
    list = list.map((d) => {
      const ings = d.dish_ingredients || [];
      const required = ings.filter((di) => !di.is_optional);
      const missing = required.filter((di) => !pantry.has(Number(di.ingredient?.id)));
      const matched = ings.filter((di) => pantry.has(Number(di.ingredient?.id)));
      const ratio = required.length > 0 ? (required.length - missing.length) / required.length : 1;
      return {
        ...d,
        match: {
          matched_count: matched.length,
          missing_count: missing.length,
          ratio: Math.round(ratio * 100) / 100,
          missing_ingredients: missing.map((di) => ({ id: Number(di.ingredient?.id), name: di.ingredient?.name })),
        },
      };
    });
    if (minMatchRatio !== undefined) list = list.filter((d) => d.match.ratio >= minMatchRatio);
  }

  // 4. Sắp xếp
  const sort = q.sort || (keyword ? 'relevance' : ingredientIds ? 'match' : 'newest');
  const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  const comparators = {
    relevance: (a, b) => (Number(matchesSearchKeyword(b.name, keyword)) - Number(matchesSearchKeyword(a.name, keyword))) || byNewest(a, b),
    match: (a, b) => ((b.match?.ratio ?? 0) - (a.match?.ratio ?? 0)) || ((b.match?.matched_count ?? 0) - (a.match?.matched_count ?? 0)),
    newest: byNewest,
    rating: (a, b) => (Number(b.avg_rating) - Number(a.avg_rating)) || (b.rating_count - a.rating_count),
    popular: (a, b) => (b.favorite_count + b.rating_count) - (a.favorite_count + a.rating_count),
    cook_time: (a, b) => (a.cook_time_minutes ?? Infinity) - (b.cook_time_minutes ?? Infinity),
    calories: (a, b) => (Number(a.calories ?? Infinity)) - (Number(b.calories ?? Infinity)),
  };
  list.sort(comparators[sort]);

  // 5. Phân trang và dữ liệu cá nhân
  const total = list.length;
  const pageItems = list.slice(pg.from, pg.to + 1);
  const favSet = await getUserFavoriteSet(req.user?.id, pageItems.map((d) => d.id));
  const data = pageItems.map((d) => ({
    ...toDishSummary(d, favSet.has(d.id)),
    ...(d.match ? { match: d.match } : {}),
  }));

  // Không có kết quả: gợi ý mở rộng tìm kiếm; có nguyên liệu mà không khớp thì mời chuyển sang chatbot (luồng 2a, 4a)
  let suggestions = [];
  if (total === 0) {
    suggestions = ['Bỏ bớt bộ lọc', 'Thử từ khóa ngắn hơn hoặc không dấu'];
    if (ingredientIds) suggestions.push('Hỏi Chatbot AI với các nguyên liệu này');
  }

  if (keyword && pg.page === 1) {
    logInteraction({ user_id: req.user?.id || null, event_type: 'search', context: { query: keyword, results: total } });
  }

  res.set('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=30');
  return sendOk(res, data, {
    meta: pageMeta(pg, total, { suggestions, suggest_ai: Boolean(ingredientIds) && total === 0 }),
  });
}

/**
 * 5.1.1 Món phổ biến / nổi bật – GET /dishes/popular?limit=&category=
 * Xếp theo lượt xem, lượt yêu thích và điểm đánh giá.
 */
export async function getPopularDishes(req, res) {
  const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1) throw new ApiError(400, 'INVALID_QUERY', 'Tham số limit không hợp lệ.');

  let query = supabaseAdmin
    .from('dishes')
    .select('id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count')
    .eq('is_published', true);
  if (typeof req.query.category === 'string' && req.query.category.trim()) {
    query = query.eq('category_normalized', normalizeText(req.query.category));
  }
  const [{ data: dishes, error }, { data: views }] = await Promise.all([
    query,
    supabaseAdmin.from('view_history').select('dish_id, view_count'),
  ]);
  if (error) throw error;

  const viewCount = new Map();
  (views || []).forEach((v) => viewCount.set(v.dish_id, (viewCount.get(v.dish_id) || 0) + v.view_count));
  const score = (d) => Math.log1p(viewCount.get(d.id) || 0) + 2 * Math.log1p(d.favorite_count || 0)
    + Number(d.avg_rating || 0) * Math.log1p(d.rating_count || 0);

  const top = (dishes || []).sort((a, b) => score(b) - score(a)).slice(0, Math.min(limit, 50));
  const favSet = await getUserFavoriteSet(req.user?.id, top.map((d) => d.id));
  return sendOk(res, top.map((d) => toDishSummary(d, favSet.has(d.id))));
}

/**
 * 4.3.2 Xem chi tiết món ăn & công thức – GET /dishes/:idOrSlug
 */
export async function getDishDetail(req, res) {
  const { idOrSlug } = req.params;
  const column = UUID_REGEX.test(idOrSlug) ? 'id' : 'slug';

  const { data: dish, error } = await supabaseAdmin
    .from('dishes')
    .select(`id, name, slug, description, image_url, category, cook_time_minutes, difficulty, servings, est_cost,
      calories, protein_g, carbs_g, fat_g, avg_rating, rating_count, favorite_count, created_at, updated_at,
      recipe_steps(step_order, content),
      dish_tags(tag:tags(id, name)),
      dish_ingredients(quantity, unit, is_optional, ingredient:ingredients(id, name, allergen_group:allergen_groups(id, name)))`)
    .eq('is_published', true)
    .eq(column, idOrSlug)
    .maybeSingle();
  if (error) throw error;
  if (!dish) return sendError(res, 404, 'DISH_NOT_FOUND', 'Món không tồn tại hoặc đã bị ẩn.');

  const userId = req.user?.id;
  const [ratingsRes, relatedRes, favRes] = await Promise.all([
    supabaseAdmin.from('ratings').select('id, user_id, stars, comment').eq('dish_id', dish.id),
    supabaseAdmin.from('dishes').select('id, name, slug, image_url')
      .eq('is_published', true).eq('category', dish.category).neq('id', dish.id).limit(6),
    userId
      ? supabaseAdmin.from('favorites').select('dish_id').eq('user_id', userId).eq('dish_id', dish.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (ratingsRes.error) throw ratingsRes.error;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (ratingsRes.data || []).forEach((r) => { distribution[r.stars] += 1; });
  const mine = userId ? (ratingsRes.data || []).find((r) => r.user_id === userId) : null;

  // Ghi nhận lượt xem cho người dùng đã đăng nhập (ngoại lệ có chủ đích của GET, mục 2.7)
  if (userId) recordView(userId, dish.id);

  return sendOk(res, {
    ...toDishSummary(dish, Boolean(favRes.data)),
    servings: dish.servings,
    est_cost: dish.est_cost != null ? Number(dish.est_cost) : null,
    nutrition: {
      calories: dish.calories != null ? Number(dish.calories) : null,
      protein_g: dish.protein_g != null ? Number(dish.protein_g) : null,
      carbs_g: dish.carbs_g != null ? Number(dish.carbs_g) : null,
      fat_g: dish.fat_g != null ? Number(dish.fat_g) : null,
    },
    ingredients: (dish.dish_ingredients || []).map((di) => ({
      ingredient_id: Number(di.ingredient?.id),
      name: di.ingredient?.name,
      quantity: Number(di.quantity),
      unit: di.unit,
      is_optional: di.is_optional,
      allergen_group: di.ingredient?.allergen_group || null,
    })),
    steps: (dish.recipe_steps || [])
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => ({ order: s.step_order, content: s.content })),
    tags: (dish.dish_tags || []).map((dt) => dt.tag).filter(Boolean),
    rating_summary: {
      average: Number(dish.avg_rating) || 0,
      count: dish.rating_count || 0,
      distribution,
    },
    my_rating: mine ? { id: mine.id, stars: mine.stars, comment: mine.comment } : null,
    related_dishes: relatedRes.data || [],
    created_at: dish.created_at,
    updated_at: dish.updated_at,
  });
}

async function recordView(userId, dishId) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('view_history')
      .select('view_count')
      .eq('user_id', userId)
      .eq('dish_id', dishId)
      .maybeSingle();
    await supabaseAdmin.from('view_history').upsert({
      user_id: userId,
      dish_id: dishId,
      view_count: (existing?.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,dish_id' });
    logInteraction({ user_id: userId, dish_id: dishId, event_type: 'view', context: { source: 'dish_detail' } });
    recomputeUserVectorsInBackground(userId);
  } catch (err) {
    console.warn('[View] Không ghi được lịch sử xem:', err.message);
  }
}
