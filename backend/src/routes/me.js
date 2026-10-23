// src/routes/me.js
// 4.5 Hồ sơ khẩu vị, 4.7 Gợi ý, 4.9 Tài khoản & dữ liệu cá nhân, 5.3, 5.5, 5.6

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { handleAvatarUpload } from '../middlewares/uploadMiddleware.js';
import { getTasteProfile, patchTasteProfile, updateTasteProfile } from '../controllers/tasteProfileController.js';
import { getRecommendations } from '../controllers/recommendationController.js';
import {
  changePassword,
  clearMyFavorites,
  clearMyViewHistory,
  deleteMe,
  getMe,
  getMyFavorites,
  getMyRatings,
  getMyViewHistory,
  updateMe,
  uploadAvatar,
} from '../controllers/meController.js';
import {
  addDishToCollection,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  removeDishFromCollection,
  renameCollection,
} from '../controllers/collectionsController.js';
import { uuidParam } from '../utils/http.js';

const router = Router();

router.use(authenticate);
router.param('collectionId', uuidParam('COLLECTION_NOT_FOUND', 'Bộ sưu tập không tồn tại.'));
router.param('dishId', uuidParam('COLLECTION_NOT_FOUND', 'Bộ sưu tập hoặc món không tồn tại.'));

// 4.9 Tài khoản
router.get('/', getMe);                                   // 4.9.1
router.patch('/', updateMe);                              // 4.9.2
router.delete('/', deleteMe);                             // 4.9.6
router.put('/password', changePassword);                  // 4.9.3
router.post('/avatar', handleAvatarUpload, uploadAvatar); // 4.9.5

// 4.5 Hồ sơ khẩu vị
router.get('/taste-profile', getTasteProfile);            // 4.5.1
router.put('/taste-profile', updateTasteProfile);         // 4.5.2
router.patch('/taste-profile', patchTasteProfile);        // 5.3.1

// 4.7 Gợi ý
router.get('/recommendations', getRecommendations);       // 4.7.1

// Dữ liệu cá nhân
router.get('/favorites', getMyFavorites);                 // 4.9.4
router.delete('/favorites', clearMyFavorites);            // 5.5.1
router.get('/ratings', getMyRatings);                     // 5.5.2
router.get('/view-history', getMyViewHistory);            // 5.5.3
router.delete('/view-history', clearMyViewHistory);       // 5.5.4

// 5.6 Bộ sưu tập
router.get('/collections', listCollections);                                              // 5.6.1
router.post('/collections', createCollection);                                            // 5.6.2
router.get('/collections/:collectionId', getCollection);                                  // 5.6.3
router.patch('/collections/:collectionId', renameCollection);                             // 5.6.4
router.delete('/collections/:collectionId', deleteCollection);                            // 5.6.5
router.put('/collections/:collectionId/dishes/:dishId', addDishToCollection);             // 5.6.6
router.delete('/collections/:collectionId/dishes/:dishId', removeDishFromCollection);     // 5.6.7

export default router;
