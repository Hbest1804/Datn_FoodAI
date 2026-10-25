// src/controllers/recommendationController.js
// Gợi ý cá nhân hóa theo mục 4.7 của tài liệu đặc tả API

import { getPersonalizedRecommendations } from '../services/recommendationService.js';
import { parseBool, sendError, sendOk } from '../utils/http.js';

/**
 * 4.7.1 Nhận gợi ý món ăn – GET /me/recommendations?limit=&category=&refresh=
 */
export async function getRecommendations(req, res) {
  const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1) {
    return sendError(res, 400, 'INVALID_QUERY', 'Tham số limit phải là số nguyên dương.');
  }
  const refresh = req.query.refresh === undefined ? false : parseBool(req.query.refresh);
  if (refresh === undefined) {
    return sendError(res, 400, 'INVALID_QUERY', 'Tham số refresh phải là true hoặc false.');
  }

  const result = await getPersonalizedRecommendations({
    userId: req.user?.id || null,
    limit: Math.min(limit, 50),
    category: typeof req.query.category === 'string' ? req.query.category.trim() : '',
    refresh,
  });
  return sendOk(res, result.data, { meta: result.meta });
}
