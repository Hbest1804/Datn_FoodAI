// src/routes/dishes.js
// 4.3 Món ăn, 4.8 Yêu thích & đánh giá, 5.1.1 Món phổ biến

import { Router } from 'express';
import { getDishDetail, getDishes, getPopularDishes } from '../controllers/dishesController.js';
import { addFavorite, createDishRating, getDishRatings, removeFavorite } from '../controllers/engagementController.js';
import { getRecommendations } from '../controllers/recommendationController.js';
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js';
import { publicReadLimiter } from '../middlewares/rateLimiter.js';
import { uuidParam } from '../utils/http.js';

const router = Router();

router.param('dishId', uuidParam('DISH_NOT_FOUND', 'Món không tồn tại.'));

router.get('/', publicReadLimiter, optionalAuthenticate, getDishes);                    // 4.3.1
router.get('/popular', publicReadLimiter, optionalAuthenticate, getPopularDishes);      // 5.1.1
// Giữ cho giao diện cũ: gợi ý công khai (khách nhận món phổ biến, đã đăng nhập thì cá nhân hóa như /me/recommendations)
router.get('/recommendations', publicReadLimiter, optionalAuthenticate, getRecommendations);

router.put('/:dishId/favorite', authenticate, addFavorite);                             // 4.8.1
router.delete('/:dishId/favorite', authenticate, removeFavorite);                       // 4.8.2
router.get('/:dishId/ratings', publicReadLimiter, getDishRatings);                      // 4.8.3
router.post('/:dishId/ratings', authenticate, createDishRating);                        // 4.8.4

router.get('/:idOrSlug', publicReadLimiter, optionalAuthenticate, getDishDetail);       // 4.3.2

export default router;
