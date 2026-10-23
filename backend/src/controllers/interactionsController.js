// src/controllers/interactionsController.js
// 5.1.2 Ghi nhận tương tác – POST /interactions → 202 (ghi bất đồng bộ vào interaction_logs)

import { supabaseAdmin } from '../config/supabase.js';
import { UUID_REGEX, sendError } from '../utils/http.js';

// page_view dùng để đếm lượt truy cập hệ thống trong thống kê
const EVENT_TYPES = ['view', 'click', 'search', 'chat_card_click', 'recommendation_click', 'share', 'page_view'];

export async function createInteraction(req, res) {
  const { event_type: eventType, dish_id: dishId, context } = req.body || {};
  if (!EVENT_TYPES.includes(eventType)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'event_type không hợp lệ.', [
      { field: 'event_type', code: 'INVALID_VALUE', message: `Chỉ nhận: ${EVENT_TYPES.join(' | ')}` },
    ]);
  }
  if (dishId !== undefined && dishId !== null && !UUID_REGEX.test(String(dishId))) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'dish_id phải là uuid.', [
      { field: 'dish_id', code: 'INVALID_VALUE', message: 'dish_id phải là uuid.' },
    ]);
  }
  const ctx = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  if (JSON.stringify(ctx).length > 2000) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'context quá lớn.');
  }

  // Xử lý bất đồng bộ, không chặn giao diện
  res.status(202).send();

  const { error } = await supabaseAdmin.from('interaction_logs').insert({
    user_id: req.user?.id || null,
    dish_id: dishId || null,
    event_type: eventType,
    context: ctx,
  });
  if (error) console.warn('[Interaction] Không ghi được interaction_logs:', error.message);
}
