// src/routes/admin.js
// 4.10 – 4.14 và 5.7 – 5.9: các API quản trị, tất cả yêu cầu vai trò admin

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';
import { adminLimiter } from '../middlewares/rateLimiter.js';
import { handleDishImageUpload, handleImportUpload } from '../middlewares/uploadMiddleware.js';
import {
  adminCreateDish,
  adminCreateDishRecipe,
  adminDeleteDish,
  adminDeleteDishRecipe,
  adminGetDishDetail,
  adminGetDishRecipe,
  adminGetDishes,
  adminGetImportTemplate,
  adminImportDishes,
  adminReindexDish,
  adminTogglePublishDish,
  adminUpdateDish,
  adminUpdateDishRecipe,
  adminUploadImage,
} from '../controllers/adminDishesController.js';
import {
  adminDeleteRating,
  adminDeleteUser,
  adminGetAuditLogs,
  adminGetUserDetail,
  adminGetUsers,
  adminUpdateUserRole,
  adminUpdateUserStatus,
} from '../controllers/adminUsersController.js';
import {
  adminFlagMessage,
  adminGetChatbotHealth,
  adminGetChatbotOverview,
  adminGetChatbotSettings,
  adminGetConversationDetail,
  adminGetConversations,
  adminGetFrequentQuestions,
  adminUpdateChatbotSettings,
} from '../controllers/adminChatbotController.js';
import {
  adminExportStats,
  adminGetStatsChatbotUsage,
  adminGetStatsOverview,
  adminGetStatsSearchTrends,
  adminGetStatsTimeseries,
  adminGetStatsTopDishes,
} from '../controllers/adminStatsController.js';
import { uuidParam } from '../utils/http.js';

const router = Router();

router.use(authenticate, requireAdmin, adminLimiter);
router.param('dishId', uuidParam('DISH_NOT_FOUND', 'Món không tồn tại.'));
router.param('userId', uuidParam('USER_NOT_FOUND', 'Người dùng không tồn tại.'));
router.param('sessionId', uuidParam('CHAT_SESSION_NOT_FOUND', 'Hội thoại không tồn tại.'));
router.param('messageId', uuidParam('MESSAGE_NOT_FOUND', 'Tin nhắn không tồn tại.'));

// 4.10 Quản lý món ăn (đường dẫn cố định đặt trước /dishes/:dishId)
router.post('/uploads/images', handleDishImageUpload, adminUploadImage);   // 4.10.6
router.get('/dishes/import/template', adminGetImportTemplate);             // 4.10.7
router.post('/dishes/import', handleImportUpload, adminImportDishes);      // 4.10.8
router.get('/dishes', adminGetDishes);                                     // 4.10.1
router.post('/dishes', adminCreateDish);                                   // 4.10.3
router.get('/dishes/:dishId', adminGetDishDetail);                         // 4.10.2
router.put('/dishes/:dishId', adminUpdateDish);                            // 4.10.4
router.delete('/dishes/:dishId', adminDeleteDish);                         // 4.10.5
router.patch('/dishes/:dishId/publish', adminTogglePublishDish);           // 5.7.1
router.post('/dishes/:dishId/reindex', adminReindexDish);                  // 5.7.2

// 4.14 Quản lý công thức
router.get('/dishes/:dishId/recipe', adminGetDishRecipe);                  // 4.14.1
router.post('/dishes/:dishId/recipe', adminCreateDishRecipe);              // 4.14.2
router.put('/dishes/:dishId/recipe', adminUpdateDishRecipe);               // 4.14.3
router.delete('/dishes/:dishId/recipe', adminDeleteDishRecipe);            // 4.14.4

// 4.11 Quản lý người dùng
router.get('/users', adminGetUsers);                                       // 4.11.1
router.get('/users/:userId', adminGetUserDetail);                          // 4.11.2
router.patch('/users/:userId/status', adminUpdateUserStatus);              // 4.11.3
router.patch('/users/:userId/role', adminUpdateUserRole);                  // 4.11.4
router.delete('/users/:userId', adminDeleteUser);                          // 4.11.5
router.get('/audit-logs', adminGetAuditLogs);                              // 4.11.6
router.delete('/ratings/:ratingId', adminDeleteRating);                    // 5.8.1

// 4.12 Giám sát chatbot
router.get('/chatbot/overview', adminGetChatbotOverview);                  // 4.12.1
router.get('/chatbot/conversations', adminGetConversations);               // 4.12.2
router.get('/chatbot/conversations/:sessionId', adminGetConversationDetail); // 4.12.3
router.get('/chatbot/settings', adminGetChatbotSettings);                  // 4.12.4
router.put('/chatbot/settings', adminUpdateChatbotSettings);               // 4.12.5
router.patch('/chatbot/messages/:messageId/flag', adminFlagMessage);       // 4.12.6
router.get('/chatbot/frequent-questions', adminGetFrequentQuestions);      // 4.12.7
router.get('/chatbot/health', adminGetChatbotHealth);                      // 4.12.8

// 4.13 Thống kê hệ thống
router.get('/stats/overview', adminGetStatsOverview);                      // 4.13.1
router.get('/stats/top-dishes', adminGetStatsTopDishes);                   // 4.13.2
router.get('/stats/timeseries', adminGetStatsTimeseries);                  // 4.13.3
router.get('/stats/search-trends', adminGetStatsSearchTrends);             // 4.13.4
router.get('/stats/export', adminExportStats);                             // 4.13.5
router.get('/stats/chatbot-usage', adminGetStatsChatbotUsage);             // 5.9.1

export default router;
