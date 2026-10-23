// src/controllers/engagementController.js
// Yêu thích, đánh giá & bình luận – mục 4.8 của tài liệu API
// avg_rating, rating_count, favorite_count trên bảng dishes được CSDL tự cập nhật ngay khi ratings/favorites thay đổi.

import { supabaseAdmin } from '../config/supabase.js';
import { containsBannedWords } from '../utils/bannedWords.js';
import { invalidateRecommendationCache } from '../services/recommendationService.js';
import { recomputeUserVectorsInBackground } from '../services/embeddingService.js';
import { pageMeta, parseBool, parsePagination, sendError, sendOk } from '../utils/http.js';

const MAX_COMMENT_LENGTH = 1000;

function dishNotFound(res) {
  return sendError(res, 404, 'DISH_NOT_FOUND', 'Món không tồn tại hoặc đã bị ẩn.');
}

async function findPublishedDish(dishId) {
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .select('id, is_published, avg_rating, rating_count, favorite_count')
    .eq('id', dishId)
    .maybeSingle();
  if (error) throw error;
  return data && data.is_published ? data : null;
}

async function readDishCounters(dishId) {
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .select('avg_rating, rating_count, favorite_count')
    .eq('id', dishId)
    .single();
  if (error) throw error;
  return data;
}

function onPreferenceChanged(userId) {
  invalidateRecommendationCache(userId);
  recomputeUserVectorsInBackground(userId);
}

/** Kiểm tra stars (bắt buộc khi tạo) và comment theo quy tắc 4.8.4. Trả về lỗi để gửi hoặc dữ liệu đã làm sạch. */
async function validateRatingInput({ stars: rawStars, comment }, { requireStars }) {
  const out = {};
  const stars = typeof rawStars === 'string' && rawStars.trim() !== '' ? Number(rawStars) : rawStars;
  if (stars !== undefined || requireStars) {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return { error: [422, 'VALIDATION_ERROR', 'Số sao phải là số nguyên từ 1 đến 5.', [
        { field: 'stars', code: 'OUT_OF_RANGE', message: 'Số sao từ 1 đến 5.' },
      ]] };
    }
    out.stars = stars;
  }
  if (comment !== undefined) {
    if (comment === null) {
      out.comment = null;
    } else {
      const trimmed = typeof comment === 'string' ? comment.trim() : '';
      if (!trimmed) return { error: [422, 'CONTENT_REJECTED', 'Bình luận không được để trống.'] };
      if (trimmed.length > MAX_COMMENT_LENGTH) return { error: [422, 'CONTENT_REJECTED', `Bình luận tối đa ${MAX_COMMENT_LENGTH} ký tự.`] };
      if (await containsBannedWords(trimmed)) return { error: [422, 'CONTENT_REJECTED', 'Bình luận chứa từ ngữ không phù hợp.'] };
      out.comment = trimmed;
    }
  }
  return { value: out };
}

/**
 * 4.8.1 Thêm vào yêu thích – PUT /dishes/:dishId/favorite (idempotent)
 */
export async function addFavorite(req, res) {
  const { dishId } = req.params;
  if (!(await findPublishedDish(dishId))) return dishNotFound(res);

  const { error } = await supabaseAdmin
    .from('favorites')
    .upsert({ user_id: req.user.id, dish_id: dishId }, { onConflict: 'user_id,dish_id', ignoreDuplicates: true });
  if (error) throw error;

  onPreferenceChanged(req.user.id);
  const counters = await readDishCounters(dishId);
  return sendOk(res, { dish_id: dishId, is_favorite: true, favorite_count: counters.favorite_count });
}

/**
 * 4.8.2 Bỏ yêu thích – DELETE /dishes/:dishId/favorite
 */
export async function removeFavorite(req, res) {
  const { dishId } = req.params;
  const { error } = await supabaseAdmin.from('favorites').delete().eq('user_id', req.user.id).eq('dish_id', dishId);
  if (error) throw error;

  const { data: dish } = await supabaseAdmin.from('dishes').select('favorite_count').eq('id', dishId).maybeSingle();
  if (!dish) return dishNotFound(res);

  onPreferenceChanged(req.user.id);
  return sendOk(res, { dish_id: dishId, is_favorite: false, favorite_count: dish.favorite_count });
}

/**
 * 4.8.3 Danh sách đánh giá & bình luận của món – GET /dishes/:dishId/ratings
 */
export async function getDishRatings(req, res) {
  const { dishId } = req.params;
  const sort = req.query.sort ?? 'newest';
  if (!['newest', 'highest', 'lowest'].includes(sort)) {
    return sendError(res, 400, 'INVALID_QUERY', 'sort phải là newest, highest hoặc lowest.');
  }
  const pg = parsePagination(req.query);

  const dish = await findPublishedDish(dishId);
  if (!dish) return sendError(res, 404, 'DISH_NOT_FOUND', 'Món không tồn tại.');

  const { data: allStars, error: starsErr } = await supabaseAdmin.from('ratings').select('stars').eq('dish_id', dishId);
  if (starsErr) throw starsErr;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (allStars || []).forEach((r) => { distribution[r.stars] += 1; });

  let query = supabaseAdmin
    .from('ratings')
    .select('id, stars, comment, created_at, updated_at, user:users(id, display_name, avatar_url)', { count: 'exact' })
    .eq('dish_id', dishId);
  if (parseBool(req.query.has_comment) === true) query = query.not('comment', 'is', null);
  if (sort === 'highest') query = query.order('stars', { ascending: false });
  if (sort === 'lowest') query = query.order('stars', { ascending: true });
  query = query.order('created_at', { ascending: false }).range(pg.from, pg.to);

  const { data, count, error } = await query;
  if (error) throw error;

  return sendOk(res, {
    summary: { average: Number(dish.avg_rating) || 0, count: dish.rating_count, distribution },
    items: (data || []).map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      // Đánh giá của tài khoản đã xóa được ẩn danh hóa (user_id = NULL)
      user: r.user
        ? { id: r.user.id, display_name: r.user.display_name, avatar_url: r.user.avatar_url }
        : { id: null, display_name: 'Người dùng đã xóa', avatar_url: null },
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  }, { meta: pageMeta(pg, count) });
}

/**
 * 4.8.4 Đánh giá & bình luận món – POST /dishes/:dishId/ratings
 */
export async function createDishRating(req, res) {
  const { dishId } = req.params;
  const checked = await validateRatingInput(req.body || {}, { requireStars: true });
  if (checked.error) return sendError(res, ...checked.error);
  if (!(await findPublishedDish(dishId))) return dishNotFound(res);

  const { data: rating, error } = await supabaseAdmin
    .from('ratings')
    .insert({ user_id: req.user.id, dish_id: dishId, stars: checked.value.stars, comment: checked.value.comment ?? null })
    .select('id, dish_id, stars, comment, created_at')
    .single();
  if (error) {
    if (error.code === '23505') {
      return sendError(res, 409, 'RATING_ALREADY_EXISTS', 'Bạn đã đánh giá món này. Hãy sửa đánh giá hiện có nếu muốn thay đổi.');
    }
    throw error;
  }

  onPreferenceChanged(req.user.id);
  const counters = await readDishCounters(dishId);
  return sendOk(res, {
    rating,
    rating_summary: { average: Number(counters.avg_rating) || 0, count: counters.rating_count },
  }, { status: 201 });
}

async function findOwnRating(req, res) {
  const ratingId = Number(req.params.ratingId);
  if (!Number.isInteger(ratingId) || ratingId <= 0) {
    sendError(res, 404, 'RATING_NOT_FOUND', 'Đánh giá không tồn tại.');
    return null;
  }
  const { data, error } = await supabaseAdmin.from('ratings').select('id, user_id').eq('id', ratingId).maybeSingle();
  if (error) throw error;
  if (!data) {
    sendError(res, 404, 'RATING_NOT_FOUND', 'Đánh giá không tồn tại.');
    return null;
  }
  if (data.user_id !== req.user.id) {
    sendError(res, 403, 'NOT_OWNER', 'Bạn chỉ có thể thao tác trên đánh giá của chính mình.');
    return null;
  }
  return data;
}

/**
 * 4.8.5 Sửa đánh giá của mình – PATCH /ratings/:ratingId
 */
export async function updateRating(req, res) {
  const rating = await findOwnRating(req, res);
  if (!rating) return undefined;

  const checked = await validateRatingInput(req.body || {}, { requireStars: false });
  if (checked.error) return sendError(res, ...checked.error);
  if (Object.keys(checked.value).length === 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Cần gửi stars hoặc comment để cập nhật.');
  }

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .update(checked.value)
    .eq('id', rating.id)
    .select('id, stars, comment, updated_at')
    .single();
  if (error) throw error;

  onPreferenceChanged(req.user.id);
  return sendOk(res, data);
}

/**
 * 4.8.6 Xóa đánh giá của mình – DELETE /ratings/:ratingId
 */
export async function deleteRating(req, res) {
  const rating = await findOwnRating(req, res);
  if (!rating) return undefined;

  const { error } = await supabaseAdmin.from('ratings').delete().eq('id', rating.id);
  if (error) throw error;

  onPreferenceChanged(req.user.id);
  return res.status(204).send();
}
