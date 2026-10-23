// src/controllers/engagementController.js
// Xử lý Yêu thích, Đánh giá & Bình luận món ăn theo mục 4.8 của tài liệu đặc tả API

import { supabaseAdmin } from '../config/supabase.js';
import { containsBannedWords } from '../utils/bannedWords.js';
import { invalidateRecommendationCache } from '../services/recommendationService.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 4.8.1 Thêm vào yêu thích
 * PUT /dishes/:dishId/favorite hoặc /api/dishes/:dishId/favorite
 * Idempotent: gọi lại khi đã yêu thích vẫn trả 200
 */
export async function addFavorite(req, res, next) {
  try {
    const userId = req.user.id;
    const { dishId } = req.params;

    if (!dishId || !UUID_REGEX.test(dishId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại hoặc đã bị ẩn.',
        },
      });
    }

    // Kiểm tra món tồn tại và đang hiển thị
    const { data: dish, error: dishErr } = await supabaseAdmin
      .from('dishes')
      .select('id, is_published')
      .eq('id', dishId)
      .maybeSingle();

    if (dishErr) throw dishErr;

    if (!dish || dish.is_published === false) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại hoặc đã bị ẩn.',
        },
      });
    }

    // Thêm vào bảng favorites (upsert/idempotent)
    const { error: insertErr } = await supabaseAdmin
      .from('favorites')
      .upsert(
        { user_id: userId, dish_id: dishId },
        { onConflict: 'user_id,dish_id', ignoreDuplicates: true }
      );

    if (insertErr) throw insertErr;

    // Hủy cache gợi ý của user vì yêu thích đã thay đổi (Quy tắc 3 mục 4.7.1)
    invalidateRecommendationCache(userId);

    // Đếm lại tổng số lượt yêu thích của món
    const { count, error: countErr } = await supabaseAdmin
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('dish_id', dishId);

    if (countErr) throw countErr;

    return res.status(200).json({
      success: true,
      data: {
        dish_id: dishId,
        is_favorite: true,
        favorite_count: count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.8.2 Bỏ yêu thích
 * DELETE /dishes/:dishId/favorite hoặc /api/dishes/:dishId/favorite
 */
export async function removeFavorite(req, res, next) {
  try {
    const userId = req.user.id;
    const { dishId } = req.params;

    if (!dishId || !UUID_REGEX.test(dishId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại hoặc đã bị ẩn.',
        },
      });
    }

    // Kiểm tra món tồn tại
    const { data: dish, error: dishErr } = await supabaseAdmin
      .from('dishes')
      .select('id')
      .eq('id', dishId)
      .maybeSingle();

    if (dishErr) throw dishErr;

    if (!dish) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại hoặc đã bị ẩn.',
        },
      });
    }

    // Xóa khỏi bảng favorites
    const { error: deleteErr } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('dish_id', dishId);

    if (deleteErr) throw deleteErr;

    // Hủy cache gợi ý của user
    invalidateRecommendationCache(userId);

    // Đếm lại số lượt yêu thích
    const { count, error: countErr } = await supabaseAdmin
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('dish_id', dishId);

    if (countErr) throw countErr;

    return res.status(200).json({
      success: true,
      data: {
        dish_id: dishId,
        is_favorite: false,
        favorite_count: count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.8.3 Danh sách đánh giá & bình luận của món
 * GET /dishes/:dishId/ratings hoặc /api/dishes/:dishId/ratings
 */
export async function getDishRatings(req, res, next) {
  try {
    const { dishId } = req.params;
    const {
      sort = 'newest',
      has_comment,
      page = 1,
      limit = 20,
    } = req.query;

    if (!dishId || !UUID_REGEX.test(dishId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại.',
        },
      });
    }

    // Kiểm tra món tồn tại
    const { data: dish, error: dishErr } = await supabaseAdmin
      .from('dishes')
      .select('id')
      .eq('id', dishId)
      .maybeSingle();

    if (dishErr) throw dishErr;
    if (!dish) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại.',
        },
      });
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // Lấy toàn bộ ratings của món để tính thống kê summary { average, count, distribution }
    const { data: allRatings, error: allRatingsErr } = await supabaseAdmin
      .from('ratings')
      .select('stars')
      .eq('dish_id', dishId);

    if (allRatingsErr) throw allRatingsErr;

    const totalRatingsCount = allRatings ? allRatings.length : 0;
    const distribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let starsSum = 0;

    (allRatings || []).forEach((r) => {
      starsSum += r.stars;
      const sKey = String(r.stars);
      if (distribution[sKey] !== undefined) {
        distribution[sKey] += 1;
      }
    });

    const averageRating = totalRatingsCount > 0
      ? Math.round((starsSum / totalRatingsCount) * 10) / 10
      : 0;

    const summary = {
      average: averageRating,
      count: totalRatingsCount,
      distribution,
    };

    // Truy vấn danh sách đánh giá phân trang
    let query = supabaseAdmin
      .from('ratings')
      .select(`
        id,
        stars,
        comment,
        created_at,
        updated_at,
        users (
          id,
          display_name
        )
      `, { count: 'exact' })
      .eq('dish_id', dishId);

    // Bộ lọc có bình luận
    const onlyWithComment = has_comment === true || has_comment === 'true' || has_comment === '1';
    if (onlyWithComment) {
      query = query.not('comment', 'is', null).neq('comment', '');
    }

    // Sắp xếp
    if (sort === 'highest') {
      query = query.order('stars', { ascending: false }).order('created_at', { ascending: false });
    } else if (sort === 'lowest') {
      query = query.order('stars', { ascending: true }).order('created_at', { ascending: false });
    } else {
      // Mặc định: newest
      query = query.order('created_at', { ascending: false });
    }

    const fromIndex = (currentPage - 1) * pageLimit;
    const toIndex = fromIndex + pageLimit - 1;
    query = query.range(fromIndex, toIndex);

    const { data: itemsData, count: filteredCount, error: itemsErr } = await query;
    if (itemsErr) throw itemsErr;

    const items = (itemsData || []).map((item) => {
      const userName = item.users?.display_name || 'Người dùng Culina';
      return {
        id: item.id,
        stars: item.stars,
        comment: item.comment,
        user: {
          id: item.users?.id || null,
          name: userName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D9488&color=fff`,
        },
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    const total = filteredCount !== null ? filteredCount : 0;
    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        summary,
        items,
      },
      meta: {
        page: currentPage,
        limit: pageLimit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.8.4 Đánh giá & bình luận món
 * POST /dishes/:dishId/ratings hoặc /api/dishes/:dishId/ratings
 */
export async function createDishRating(req, res, next) {
  try {
    const userId = req.user.id;
    const { dishId } = req.params;
    const { stars, comment } = req.body || {};

    if (!dishId || !UUID_REGEX.test(dishId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại.',
        },
      });
    }

    // 1. Kiểm tra số sao hợp lệ (Quy tắc 1: số nguyên 1–5, bắt buộc)
    const numStars = Number(stars);
    if (!Number.isInteger(numStars) || numStars < 1 || numStars > 5) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'CONTENT_REJECTED',
          message: 'Số sao đánh giá phải là số nguyên từ 1 đến 5.',
        },
      });
    }

    // 2. Kiểm tra bình luận (Quy tắc 2: không bắt buộc; nếu có thì không rỗng sau trim, tối đa 1000 ký tự và không chứa từ cấm)
    let processedComment = null;
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTENT_REJECTED',
            message: 'Nội dung bình luận phải là dạng chuỗi.',
          },
        });
      }
      const trimmed = comment.trim();
      if (trimmed.length === 0) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTENT_REJECTED',
            message: 'Bình luận không được để trống khi nhập.',
          },
        });
      }
      if (trimmed.length > 1000) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTENT_REJECTED',
            message: 'Bình luận không được vượt quá 1000 ký tự.',
          },
        });
      }
      if (containsBannedWords(trimmed)) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTENT_REJECTED',
            message: 'Bình luận chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.',
          },
        });
      }
      processedComment = trimmed;
    }

    // 3. Kiểm tra món ăn tồn tại
    const { data: dish, error: dishErr } = await supabaseAdmin
      .from('dishes')
      .select('id')
      .eq('id', dishId)
      .maybeSingle();

    if (dishErr) throw dishErr;
    if (!dish) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DISH_NOT_FOUND',
          message: 'Món ăn không tồn tại.',
        },
      });
    }

    // 4. Kiểm tra người dùng đã đánh giá món này chưa (Quy tắc 3: mỗi người chỉ đánh giá 1 lần cho mỗi món)
    const { data: existingRating, error: existErr } = await supabaseAdmin
      .from('ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('dish_id', dishId)
      .maybeSingle();

    if (existErr) throw existErr;

    if (existingRating) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RATING_ALREADY_EXISTS',
          message: 'Bạn đã đánh giá món ăn này rồi. Vui lòng chỉnh sửa đánh giá hiện tại nếu muốn thay đổi.',
        },
      });
    }

    // 5. Thêm mới đánh giá
    const { data: newRating, error: insertErr } = await supabaseAdmin
      .from('ratings')
      .insert({
        user_id: userId,
        dish_id: dishId,
        stars: numStars,
        comment: processedComment,
      })
      .select('id, dish_id, stars, comment, created_at')
      .single();

    if (insertErr) throw insertErr;

    // Hủy cache gợi ý của user
    invalidateRecommendationCache(userId);

    // 6. Tính lại rating_summary của món
    const { data: allRatings, error: calcErr } = await supabaseAdmin
      .from('ratings')
      .select('stars')
      .eq('dish_id', dishId);

    if (calcErr) throw calcErr;

    const totalCount = allRatings ? allRatings.length : 0;
    const sum = (allRatings || []).reduce((acc, r) => acc + r.stars, 0);
    const avg = totalCount > 0 ? Math.round((sum / totalCount) * 10) / 10 : numStars;

    return res.status(201).json({
      success: true,
      data: {
        rating: {
          id: newRating.id,
          dish_id: newRating.dish_id,
          stars: newRating.stars,
          comment: newRating.comment,
          created_at: newRating.created_at,
        },
        rating_summary: {
          average: avg,
          count: totalCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.8.5 Sửa đánh giá của mình
 * PATCH /ratings/:ratingId hoặc /api/ratings/:ratingId
 */
export async function updateRating(req, res, next) {
  try {
    const userId = req.user.id;
    const { ratingId } = req.params;
    const parsedRatingId = parseInt(ratingId, 10);

    if (isNaN(parsedRatingId) || parsedRatingId <= 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RATING_NOT_FOUND',
          message: 'Đánh giá không tồn tại.',
        },
      });
    }

    // 1. Kiểm tra tồn tại và quyền sở hữu (Quy tắc: Chủ đánh giá)
    const { data: rating, error: fetchErr } = await supabaseAdmin
      .from('ratings')
      .select('id, user_id, dish_id, stars, comment')
      .eq('id', parsedRatingId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!rating) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RATING_NOT_FOUND',
          message: 'Đánh giá không tồn tại.',
        },
      });
    }

    if (rating.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_OWNER',
          message: 'Không phải đánh giá của bạn. Bạn chỉ có thể sửa đánh giá của chính mình.',
        },
      });
    }

    const { stars, comment } = req.body || {};
    const updates = {
      updated_at: new Date().toISOString(),
    };

    // 2. Validate stars nếu có cập nhật
    if (stars !== undefined) {
      const numStars = Number(stars);
      if (!Number.isInteger(numStars) || numStars < 1 || numStars > 5) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'CONTENT_REJECTED',
            message: 'Số sao đánh giá phải là số nguyên từ 1 đến 5.',
          },
        });
      }
      updates.stars = numStars;
    }

    // 3. Validate comment nếu có cập nhật
    if (comment !== undefined) {
      if (comment === null) {
        updates.comment = null;
      } else {
        if (typeof comment !== 'string') {
          return res.status(422).json({
            success: false,
            error: {
              code: 'CONTENT_REJECTED',
              message: 'Nội dung bình luận phải là dạng chuỗi.',
            },
          });
        }
        const trimmed = comment.trim();
        if (trimmed.length === 0) {
          return res.status(422).json({
            success: false,
            error: {
              code: 'CONTENT_REJECTED',
              message: 'Nội dung bình luận không được để trống khi gửi.',
            },
          });
        }
        if (trimmed.length > 1000) {
          return res.status(422).json({
            success: false,
            error: {
              code: 'CONTENT_REJECTED',
              message: 'Bình luận không được vượt quá 1000 ký tự.',
            },
          });
        }
        if (containsBannedWords(trimmed)) {
          return res.status(422).json({
            success: false,
            error: {
              code: 'CONTENT_REJECTED',
              message: 'Bình luận chứa từ ngữ không phù hợp với tiêu chuẩn cộng đồng.',
            },
          });
        }
        updates.comment = trimmed;
      }
    }

    // 4. Cập nhật vào DB
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('ratings')
      .update(updates)
      .eq('id', parsedRatingId)
      .select('id, stars, comment, updated_at')
      .single();

    if (updateErr) throw updateErr;

    // Hủy cache gợi ý của user
    invalidateRecommendationCache(userId);

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        stars: updated.stars,
        comment: updated.comment,
        updated_at: updated.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.8.6 Xóa đánh giá của mình
 * DELETE /ratings/:ratingId hoặc /api/ratings/:ratingId
 */
export async function deleteRating(req, res, next) {
  try {
    const userId = req.user.id;
    const { ratingId } = req.params;
    const parsedRatingId = parseInt(ratingId, 10);

    if (isNaN(parsedRatingId) || parsedRatingId <= 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RATING_NOT_FOUND',
          message: 'Đánh giá không tồn tại.',
        },
      });
    }

    // 1. Kiểm tra tồn tại và quyền sở hữu (Quy tắc: Chủ đánh giá)
    const { data: rating, error: fetchErr } = await supabaseAdmin
      .from('ratings')
      .select('id, user_id, dish_id')
      .eq('id', parsedRatingId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!rating) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RATING_NOT_FOUND',
          message: 'Đánh giá không tồn tại.',
        },
      });
    }

    if (rating.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_OWNER',
          message: 'Không phải đánh giá của bạn. Bạn không có quyền xóa đánh giá của người khác.',
        },
      });
    }

    // 2. Xóa khỏi DB
    const { error: delErr } = await supabaseAdmin
      .from('ratings')
      .delete()
      .eq('id', parsedRatingId);

    if (delErr) throw delErr;

    // Hủy cache gợi ý của user
    invalidateRecommendationCache(userId);

    // Trả về 204 No Content
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
