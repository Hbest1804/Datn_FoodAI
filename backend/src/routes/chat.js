// src/routes/chat.js
// 4.4 Chatbot khách, 4.6 Chatbot cá nhân hóa, 5.2 – 5.4 API phụ của chatbot

import { Router } from 'express';
import { getGuestQuota, sendGuestMessage } from '../controllers/guestChatController.js';
import {
  createChatSession,
  deleteAllChatSessions,
  deleteChatSession,
  getChatSessionById,
  getChatSessions,
  sendChatMessage,
  sendChatMessageFeedback,
  updateChatSession,
} from '../controllers/chatController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { guestChatLimiter, userChatLimiter } from '../middlewares/rateLimiter.js';
import { uuidParam } from '../utils/http.js';

const router = Router();

router.param('sessionId', uuidParam('CHAT_SESSION_NOT_FOUND', 'Hội thoại không tồn tại.'));
router.param('messageId', uuidParam('MESSAGE_NOT_FOUND', 'Tin nhắn không tồn tại.'));

// Chế độ khách
router.post('/guest/messages', guestChatLimiter, sendGuestMessage);   // 4.4.1
router.get('/guest/quota', getGuestQuota);                            // 5.2.1

// Người dùng đã đăng nhập
router.post('/sessions', authenticate, createChatSession);                                     // 4.6.1
router.get('/sessions', authenticate, getChatSessions);                                        // 4.6.2
router.delete('/sessions', authenticate, deleteAllChatSessions);                               // 5.4.2
router.get('/sessions/:sessionId', authenticate, getChatSessionById);                          // 4.6.3
router.patch('/sessions/:sessionId', authenticate, updateChatSession);                         // 5.4.1
router.delete('/sessions/:sessionId', authenticate, deleteChatSession);                        // 4.6.5
router.post('/sessions/:sessionId/messages', authenticate, userChatLimiter, sendChatMessage);  // 4.6.4
router.post('/messages/:messageId/feedback', authenticate, sendChatMessageFeedback);           // 4.6.6

export default router;
