// src/routes/me.js
// Routes cho Hồ sơ khẩu vị, gợi ý cá nhân hóa và thông tin cá nhân

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  getTasteProfile,
  updateTasteProfile,
  patchTasteProfile,
} from '../controllers/tasteProfileController.js';
import { getRecommendations } from '../controllers/recommendationController.js';
import { handleAvatarUpload } from '../middlewares/uploadMiddleware.js';
import { uploadUserAvatar } from '../controllers/uploadController.js';
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  deleteMyAccount,
  getMyFavorites,
  clearMyFavorites,
  getMyRatings,
  getMyViewHistory,
  clearMyViewHistory,
  deleteMyChatHistory,
} from '../controllers/adminController.js';

const router = Router();

// Mọi API trong nhóm yêu cầu đăng nhập (authenticate middleware)
router.use(authenticate);

// 4.5.1 Xem hồ sơ khẩu vị - GET /me/taste-profile
router.get('/taste-profile', getTasteProfile);

// 4.5.2 Lưu hồ sơ khẩu vị (ghi đè toàn bộ) - PUT /me/taste-profile
router.put('/taste-profile', updateTasteProfile);

// 5.3.1 Cập nhật một phần hồ sơ khẩu vị - PATCH /me/taste-profile
router.patch('/taste-profile', patchTasteProfile);

// 4.7.1 Nhận gợi ý món ăn - GET /me/recommendations
router.get('/recommendations', getRecommendations);

// 5.6.1 Tải ảnh đại diện - POST /me/avatar
router.post('/avatar', handleAvatarUpload, uploadUserAvatar);

// Section 4.9 & 5.5: Dữ liệu cá nhân
router.get('/profile', getMyProfile);
router.get('/', getMyProfile);
router.put('/profile', updateMyProfile);
router.patch('/', updateMyProfile);
router.patch('/password', changeMyPassword);
router.put('/password', changeMyPassword);
router.delete('/', deleteMyAccount);
router.get('/favorites', getMyFavorites);
router.delete('/favorites', clearMyFavorites);
router.get('/ratings', getMyRatings);
router.get('/view-history', getMyViewHistory);
router.delete('/view-history', clearMyViewHistory);
router.delete('/chat-history', deleteMyChatHistory);

export default router;

