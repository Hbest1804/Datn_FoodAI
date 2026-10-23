// src/middlewares/rateLimiter.js
// Giới hạn tần suất request (Rate Limiting) bảo vệ các endpoint nhạy cảm

import rateLimit from 'express-rate-limit';
import { env } from '../config/appConfig.js';

/**
 * Rate limiter cho các API xác thực (Login, Register, Forgot Password, Reset Password)
 * Ngăn chặn brute-force và credential stuffing
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20, // Tối đa 20 yêu cầu trên mỗi IP trong 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Bạn đã thử đăng nhập/thao tác xác thực quá nhiều lần từ IP này. Vui lòng đợi 15 phút trước khi thử lại.',
      },
    });
  },
});

/**
 * Rate limiter theo IP cho Chatbot chế độ khách (Guest Chat)
 * Ngăn chặn người dùng xóa/thay đổi header X-Guest-Id để qua mặt hạn mức
 */
export const guestChatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 giờ
  max: (env.guestChatLimit || 5) * 2, // Cho phép tối đa gấp đôi hạn mức guest trên 1 IP trong ngày (phòng trường hợp chung mạng nội bộ nhẹ)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      error: {
        code: 'GUEST_LIMIT_EXCEEDED',
        message: 'Địa chỉ IP của bạn đã sử dụng hết hạn mức hỏi đáp ở Chế độ Khách trong ngày hôm nay. Vui lòng đăng ký hoặc đăng nhập tài khoản miễn phí để tiếp tục.',
        details: {
          cta: ['register', 'login'],
        },
      },
    });
  },
});
