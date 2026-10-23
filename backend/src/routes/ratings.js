// src/routes/ratings.js
// 4.8.5 – 4.8.6 Sửa / xóa đánh giá của mình

import { Router } from 'express';
import { deleteRating, updateRating } from '../controllers/engagementController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.patch('/:ratingId', authenticate, updateRating);
router.delete('/:ratingId', authenticate, deleteRating);

export default router;
