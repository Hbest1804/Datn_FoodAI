// src/routes/chat.js
// Routes cho Chatbot AI (mục 4.4, 4.6, 5.2.1)

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { guestChatLimiter } from '../middlewares/rateLimiter.js';
import { sendGuestMessage, getGuestQuota } from '../controllers/guestChatController.js';
import {
  createChatSession,
  getChatSessions,
  getChatSessionById,
  sendChatMessage,
  deleteChatSession,
  sendChatMessageFeedback,
  updateChatSession,
} from '../controllers/chatController.js';

const router = Router();

// ── 4.4 Chatbot Chế độ Khách ──────────────────────────────────────────
// 4.4.1 Gửi câu hỏi (khách) - POST /chat/guest/messages
router.post('/guest/messages', guestChatLimiter, sendGuestMessage);

// 5.2.1 Xem hạn mức lượt hỏi còn lại - GET /chat/guest/quota
router.get('/guest/quota', getGuestQuota);

// ── 4.6 Chatbot Cá nhân hóa ───────────────────────────────────────────
// Các route yêu cầu người dùng đăng nhập (authenticate middleware)

// 4.6.1 Tạo hội thoại mới - POST /chat/sessions
router.post('/sessions', authenticate, createChatSession);

// 4.6.2 Danh sách hội thoại - GET /chat/sessions
router.get('/sessions', authenticate, getChatSessions);

// 4.6.3 Mở lại hội thoại cũ - GET /chat/sessions/:sessionId
router.get('/sessions/:sessionId', authenticate, getChatSessionById);

// 4.6.4 Gửi câu hỏi cho chatbot - POST /chat/sessions/:sessionId/messages
router.post('/sessions/:sessionId/messages', authenticate, sendChatMessage);

// 4.6.5 Xóa một hội thoại - DELETE /chat/sessions/:sessionId
router.delete('/sessions/:sessionId', authenticate, deleteChatSession);

// 4.6.6 Đánh giá câu trả lời của chatbot - POST /chat/messages/:messageId/feedback
router.post('/messages/:messageId/feedback', authenticate, sendChatMessageFeedback);

// API Bổ sung: Đổi tiêu đề hội thoại - PATCH /chat/sessions/:sessionId
router.patch('/sessions/:sessionId', authenticate, updateChatSession);

export default router;

