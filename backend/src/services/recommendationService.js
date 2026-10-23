// src/services/recommendationService.js
// Gợi ý cá nhân hóa – mục 4.7.1 của tài liệu API
// Điểm = w_sim·S_sim + w_rating·S_rating + w_pop·S_pop + w_budget·S_budget + w_cal·S_cal, nằm trong [0; 1];
// trọng số lấy từ app_settings.recommendation_weights; lý do gợi ý sinh từ câu mẫu, không gọi AI.

import { supabaseAdmin } from '../config/supabase.js';
import { getSettings } from './settingsService.js';
import { cosineSimilarity, getDishEmbeddings, parseVector } from './embeddingService.js';
import { getForbiddenIngredientIds } from './chatContextService.js';
import { fetchTasteProfile } from './tasteProfileService.js';
import { normalizeText } from '../utils/textUtils.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const recommendationCache = new Map();

/** Xóa bộ nhớ đệm gợi ý khi hồ sơ, yêu thích hoặc đánh giá thay đổi (quy tắc 3). */
export function invalidateRecommendationCache(userId) {
  if (!userId) return;
  for (const key of recommendationCache.keys()) {
    if (key.startsWith(`${userId}|`)) recommendationCache.delete(key);
  }
}

const DISH_FIELDS = 'id, name, slug, description, image_url, category, category_normalized, cook_time_minutes, difficulty, calories, servings, est_cost, avg_rating, rating_count, favorite_count, dish_ingredients(ingredient_id)';

export function toDishSummary(d, isFavorite = false) {
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    image_url: d.image_url,
    category: d.category,
    cook_time_minutes: d.cook_time_minutes,
    difficulty: d.difficulty,
    calories: d.calories != null ? Number(d.calories) : null,
    avg_rating: Number(d.avg_rating) || 0,
    rating_count: d.rating_count || 0,
    favorite_count: d.favorite_count || 0,
    is_favorite: isFavorite,
  };
}

// ── Các thành phần điểm, mỗi thành phần ∈ [0; 1] ─────────────────────────────

/** Điểm đánh giá có hiệu chỉnh (cộng 3 lượt giả định 3.5 sao) để món ít đánh giá không bị đẩy quá cao. */
function ratingScore(d) {
  const m = 3;
  const prior = 3.5;
  const count = d.rating_count || 0;
  const avg = Number(d.avg_rating) || 0;
  return ((avg * count + prior * m) / (count + m)) / 5;
}

function budgetScore(d, profile) {
  const min = profile.budget_min;
  const max = profile.budget_max;
  if ((min == null && max == null) || d.est_cost == null || !d.servings) return null;
  const perPerson = Number(d.est_cost) / d.servings;
  const lo = min ?? 0;
  const hi = max ?? Infinity;
  if (perPerson >= lo && perPerson <= hi) return 1;
  const ref = perPerson < lo ? lo : hi;
  return Math.max(0, 1 - Math.abs(perPerson - ref) / Math.max(ref, 1));
}

function calorieScore(d, profile) {
  if (!profile.calorie_goal || d.calories == null) return null;
  const target = Number(profile.calorie_goal) / 3; // một bữa ≈ 1/3 mục tiêu ngày
  return Math.max(0, 1 - Math.abs(Number(d.calories) - target) / target);
}

const REASON_TEMPLATES = {
  sim: () => 'Hợp với khẩu vị và các món bạn đã yêu thích',
  rating: (d) => `Được đánh giá cao (${(Number(d.avg_rating) || 0).toFixed(1)}/5 từ ${d.rating_count} lượt)`,
  pop: (d) => `Được nhiều người yêu thích (${d.favorite_count} lượt)`,
  budget: (d) => `Phù hợp ngân sách (khoảng ${Math.round(Number(d.est_cost) / d.servings).toLocaleString('vi-VN')}đ/người)`,
  cal: (d) => `Lượng calo phù hợp mục tiêu (${Math.round(Number(d.calories))} kcal/khẩu phần)`,
};

/**
 * Danh sách gợi ý cho người dùng (hoặc món phổ biến khi chưa đủ dữ liệu).
 */
export async function getPersonalizedRecommendations({ userId, limit = 12, category, refresh = false }) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
  const categoryKey = category ? normalizeText(category) : '';
  const cacheKey = `${userId || 'guest'}|${categoryKey}`;

  if (!refresh) {
    const cached = recommendationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.items.slice(0, safeLimit), meta: cached.meta };
    }
  }

  const settings = await getSettings();
  const weights = { sim: 0.45, rating: 0.2, pop: 0.15, budget: 0.1, cal: 0.1, ...(settings.recommendation_weights || {}) };

  // 1. Dữ liệu người dùng
  let profile = { completeness: 0, allergen_group_ids: [], disliked_ingredient_ids: [] };
  let tasteVector = null;
  let favSet = new Set();
  let hasInteractions = false;
  if (userId) {
    const [p, vecRes, favs, ratings, views] = await Promise.all([
      fetchTasteProfile(userId),
      supabaseAdmin.from('user_profiles').select('taste_vector').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('favorites').select('dish_id').eq('user_id', userId),
      supabaseAdmin.from('ratings').select('dish_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabaseAdmin.from('view_history').select('dish_id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    profile = p;
    tasteVector = parseVector(vecRes.data?.taste_vector);
    favSet = new Set((favs.data || []).map((f) => f.dish_id));
    hasInteractions = favSet.size > 0 || (ratings.count || 0) > 0 || (views.count || 0) > 0;
  }

  // Người dùng mới, chưa đủ dữ liệu → món phổ biến (luồng 3a)
  const personalized = Boolean(tasteVector) && (profile.completeness >= 30 || hasInteractions);
  const strategy = personalized ? 'personalized' : 'popular_fallback';

  // 2. Món ứng viên đã loại nguyên liệu dị ứng / không thích / needs_review (khi có dị ứng)
  let query = supabaseAdmin.from('dishes').select(DISH_FIELDS).eq('is_published', true);
  if (categoryKey) query = query.eq('category_normalized', categoryKey);
  const [{ data: dishes, error }, forbidden, embeddings] = await Promise.all([
    query,
    getForbiddenIngredientIds({
      allergenGroupIds: profile.allergen_group_ids,
      dislikedIngredientIds: profile.disliked_ingredient_ids,
    }),
    personalized ? getDishEmbeddings() : Promise.resolve(new Map()),
  ]);
  if (error) throw error;

  const candidates = (dishes || []).filter((d) =>
    !(d.dish_ingredients || []).some((di) => forbidden.has(Number(di.ingredient_id))));

  // 3. Chấm điểm
  const maxPop = Math.max(1, ...candidates.map((d) => (d.favorite_count || 0) + (d.rating_count || 0)));
  const items = candidates.map((d) => {
    const parts = {
      sim: personalized && embeddings.has(d.id) ? Math.max(0, cosineSimilarity(tasteVector, embeddings.get(d.id))) : null,
      rating: ratingScore(d),
      pop: Math.log1p((d.favorite_count || 0) + (d.rating_count || 0)) / Math.log1p(maxPop),
      budget: budgetScore(d, profile),
      cal: calorieScore(d, profile),
    };
    // Thành phần chưa có dữ liệu được bỏ ra và chia lại trọng số cho các thành phần còn lại
    let weightSum = 0;
    let score = 0;
    for (const [k, v] of Object.entries(parts)) {
      if (v === null) continue;
      weightSum += weights[k];
      score += weights[k] * v;
    }
    score = weightSum > 0 ? score / weightSum : 0;

    const contributions = Object.entries(parts)
      .filter(([, v]) => v !== null && v > 0)
      .map(([k, v]) => [k, weights[k] * v])
      .sort((a, b) => b[1] - a[1]);
    const reasons = contributions
      .filter(([k]) => k !== 'pop' || d.favorite_count > 0)
      .filter(([k]) => k !== 'rating' || d.rating_count > 0)
      .slice(0, 2)
      .map(([k]) => REASON_TEMPLATES[k](d));
    if (reasons.length === 0) reasons.push('Món nổi bật được nhiều người quan tâm');

    return {
      dish: toDishSummary(d, favSet.has(d.id)),
      score: Math.round(Math.min(1, Math.max(0, score)) * 10000) / 10000,
      reasons,
    };
  });
  items.sort((a, b) => b.score - a.score);

  const meta = {
    strategy,
    profile_completeness: profile.completeness,
    prompt_complete_profile: !personalized || profile.completeness < 50,
    generated_at: new Date().toISOString(),
  };
  recommendationCache.set(cacheKey, { items, meta, expiresAt: Date.now() + CACHE_TTL_MS });
  return { data: items.slice(0, safeLimit), meta };
}
