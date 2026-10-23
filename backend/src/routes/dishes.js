import express from 'express';
import {
  getDishes,
  getDishDetail
} from '../controllers/dishesController.js';
import { getRecommendations } from '../controllers/recommendationController.js';
import {
  addFavorite,
  removeFavorite,
  getDishRatings,
  createDishRating,
} from '../controllers/engagementController.js';
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

// 4.3.1 Tìm kiếm & lọc món ăn
// GET /dishes hoặc /api/dishes
router.get('/', optionalAuthenticate, getDishes);

// Tiện ích GET /dishes/popular: chuyển tiếp tới sort=popular
router.get('/popular', optionalAuthenticate, (req, _res, next) => {
  req.query.sort = req.query.sort || 'popular';
  next();
}, getDishes);

// Gợi ý món ăn công khai / cá nhân hóa - GET /dishes/recommendations
router.get('/recommendations', optionalAuthenticate, getRecommendations);

// 4.8.1 Thêm vào yêu thích - PUT /dishes/:dishId/favorite
router.put('/:dishId/favorite', authenticate, addFavorite);

// 4.8.2 Bỏ yêu thích - DELETE /dishes/:dishId/favorite
router.delete('/:dishId/favorite', authenticate, removeFavorite);

// 4.8.3 Danh sách đánh giá & bình luận của món - GET /dishes/:dishId/ratings
router.get('/:dishId/ratings', optionalAuthenticate, getDishRatings);

// 4.8.4 Đánh giá & bình luận món - POST /dishes/:dishId/ratings
router.post('/:dishId/ratings', authenticate, createDishRating);

// 4.3.2 Xem chi tiết món ăn & công thức
// GET /dishes/:idOrSlug hoặc /api/dishes/:idOrSlug
router.get('/:idOrSlug', optionalAuthenticate, getDishDetail);

export default router;

