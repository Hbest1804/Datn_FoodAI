// src/middlewares/rateLimiter.js
// Giới hạn tần suất theo mục 2.6 của tài liệu API.
// Kết quả trả về có X-RateLimit-Limit, X-RateLimit-Remaining và Retry-After khi bị chặn.

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendError } from '../utils/http.js';

const MINUTE = 60 * 1000;

function limiter({ windowMs, max, byUser = false, keyPrefix, message }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: false,
    legacyHeaders: true,
    keyGenerator: (req) => `${keyPrefix}:${byUser && req.user?.id ? req.user.id : ipKeyGenerator(req.ip)}`,
    handler: (req, res) => {
      const resetMs = req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : windowMs;
      const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return sendError(res, 429, 'TOO_MANY_REQUESTS', message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', { retry_after: retryAfter });
    },
  });
}

/** Đọc công khai (GET /dishes, /meta...): 120 request / phút / IP */
export const publicReadLimiter = limiter({ windowMs: MINUTE, max: 120, keyPrefix: 'read' });

/** Xác thực (/auth/*): 10 request / phút / IP */
export const authLimiter = limiter({ windowMs: MINUTE, max: 10, keyPrefix: 'auth' });

/** Quên mật khẩu: 3 / 15 phút / IP (giới hạn theo email nằm trong authService) */
export const forgotPasswordLimiter = limiter({
  windowMs: 15 * MINUTE,
  max: 3,
  keyPrefix: 'forgot',
  message: 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
});

/** Chatbot người dùng: 20 tin nhắn / phút / user_id */
export const userChatLimiter = limiter({ windowMs: MINUTE, max: 20, byUser: true, keyPrefix: 'chat' });

/** Chatbot khách: 10 request / phút / IP (hạn mức lượt hỏi kiểm tra trong controller) */
export const guestChatLimiter = limiter({ windowMs: MINUTE, max: 10, keyPrefix: 'guest' });

/** Admin: 300 request / phút / user_id */
export const adminLimiter = limiter({ windowMs: MINUTE, max: 300, byUser: true, keyPrefix: 'admin' });
