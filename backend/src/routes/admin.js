// src/routes/admin.js
// Routes cho khu vực quản trị

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware.js';
import {
  // Quản lý món ăn
  adminGetDishes,
  adminCreateDish,
  adminGetDishDetail,
  adminUpdateDish,
  adminTogglePublishDish,
  adminDeleteDish,
  adminCreateDishRecipe,
  adminUpdateDishRecipe,
  adminGetDishRecipe,
  adminDeleteDishRecipe,
  adminReindexDish,
  // Quản lý dữ liệu nền (Master Data)
  adminGetMasterResource,
  adminCreateMasterResource,
  adminUpdateMasterResource,
  adminDeleteMasterResource,
  // Quản lý người dùng & Audit logs
  adminGetUsers,
  adminGetUserDetail,
  adminUpdateUser,
  adminUpdateUserStatus,
  adminUpdateUserRole,
  adminDeleteUser,
  adminGetAuditLogs,
  adminDeleteRating,
  // Giám sát chatbot
  adminGetChatbotOverview,
  adminGetChatSessions,
  adminGetChatSessionDetail,
  adminFlagChatMessage,
  adminGetChatbotFrequentQuestions,
  adminGetChatbotHealth,
  adminGetChatbotConfig,
  adminUpdateChatbotConfig,
  // Thống kê
  adminGetStats,
  adminGetStatsTopDishes,
  adminGetStatsTimeseries,
  adminGetStatsSearchTrends,
  adminGetStatsChatbotUsage,
  adminGetStatsExport,
  // Danh mục
  adminGetCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
} from '../controllers/adminController.js';
import { handleDishImageUpload } from '../middlewares/uploadMiddleware.js';
import { uploadDishImage } from '../controllers/uploadController.js';

const router = Router();

// ─── Bảo vệ tất cả route quản trị dưới đây: bắt buộc phải có quyền Admin ─────
router.use('/admin', authenticate, requireAdmin);

// Upload hình ảnh món ăn
router.post('/admin/uploads/images', handleDishImageUpload, uploadDishImage);

// Quản lý món ăn
router.get('/admin/dishes', adminGetDishes);
router.post('/admin/dishes', adminCreateDish);
router.get('/admin/dishes/:dishId', adminGetDishDetail);
router.put('/admin/dishes/:dishId', adminUpdateDish);
router.patch('/admin/dishes/:dishId/publish', adminTogglePublishDish);
router.delete('/admin/dishes/:dishId', adminDeleteDish);
router.get('/admin/dishes/:dishId/recipe', adminGetDishRecipe);
router.post('/admin/dishes/:dishId/recipe', adminCreateDishRecipe);
router.put('/admin/dishes/:dishId/recipe', adminUpdateDishRecipe);
router.delete('/admin/dishes/:dishId/recipe', adminDeleteDishRecipe);
// Section 5.7.2 – Cập nhật lại embedding của món ăn bằng gemini-embedding-2
router.post('/admin/dishes/:dishId/reindex', adminReindexDish);

// Section 4.11 – Quản lý dữ liệu nền (Master Data)
router.get('/admin/master/:resource', adminGetMasterResource);
router.post('/admin/master/:resource', adminCreateMasterResource);
router.put('/admin/master/:resource/:id', adminUpdateMasterResource);
router.delete('/admin/master/:resource/:id', adminDeleteMasterResource);

// Quản lý người dùng & Nhật ký thao tác
router.get('/admin/users', adminGetUsers);
router.get('/admin/users/:userId', adminGetUserDetail);
router.patch('/admin/users/:userId/status', adminUpdateUserStatus);
router.patch('/admin/users/:userId/role', adminUpdateUserRole);
router.patch('/admin/users/:userId', adminUpdateUser);
router.delete('/admin/users/:userId', adminDeleteUser);
router.get('/admin/audit-logs', adminGetAuditLogs);
// Section 5.8.1 – Gỡ bình luận vi phạm
router.delete('/admin/ratings/:ratingId', adminDeleteRating);

// Giám sát chatbot
router.get('/admin/chatbot/overview', adminGetChatbotOverview);
router.get('/admin/chatbot/sessions', adminGetChatSessions);
router.get('/admin/chatbot/conversations', adminGetChatSessions);
router.get('/admin/chatbot/sessions/:sessionId', adminGetChatSessionDetail);
router.get('/admin/chatbot/conversations/:sessionId', adminGetChatSessionDetail);
router.patch('/admin/chatbot/messages/:messageId/flag', adminFlagChatMessage);
router.get('/admin/chatbot/frequent-questions', adminGetChatbotFrequentQuestions);
router.get('/admin/chatbot/health', adminGetChatbotHealth);
router.get('/admin/chatbot/config', adminGetChatbotConfig);
router.put('/admin/chatbot/config', adminUpdateChatbotConfig);
router.get('/admin/chatbot/settings', adminGetChatbotConfig);
router.put('/admin/chatbot/settings', adminUpdateChatbotConfig);

// Thống kê hệ thống
router.get('/admin/stats', adminGetStats);
router.get('/admin/stats/overview', adminGetStats);
router.get('/admin/stats/top-dishes', adminGetStatsTopDishes);
router.get('/admin/stats/timeseries', adminGetStatsTimeseries);
router.get('/admin/stats/search-trends', adminGetStatsSearchTrends);
router.get('/admin/stats/chatbot-usage', adminGetStatsChatbotUsage);
router.get('/admin/stats/export', adminGetStatsExport);

// Danh mục
router.get('/admin/categories', adminGetCategories);
router.post('/admin/categories', adminCreateCategory);
router.put('/admin/categories/:categoryId', adminUpdateCategory);
router.delete('/admin/categories/:categoryId', adminDeleteCategory);

export default router;
