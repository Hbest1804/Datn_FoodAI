// src/controllers/recommendationController.js
// Xử lý Gợi ý cá nhân hóa theo mục 4.7 của tài liệu đặc tả API

import { getPersonalizedRecommendations } from '../services/recommendationService.js';

/**
 * 4.7.1 Nhận gợi ý món ăn
 * GET /me/recommendations hoặc /api/me/recommendations
 */
export async function getRecommendations(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const {
      limit = 12,
      category_id,
      region_id,
      refresh,
    } = req.query;

    const parsedLimit = limit !== undefined ? Number(limit) : 12;
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Tham số limit không hợp lệ (phải là số nguyên dương).',
        },
      });
    }

    const isRefresh = refresh === true || refresh === 'true' || refresh === '1';

    const result = await getPersonalizedRecommendations({
      userId,
      limit: parsedLimit,
      categoryId: category_id,
      regionId: region_id,
      refresh: isRefresh,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
