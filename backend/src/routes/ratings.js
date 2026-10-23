// src/routes/ratings.js
// Routes cho sửa và xóa đánh giá (mục 4.8.5 và 4.8.6)

import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  updateRating,
  deleteRating,
} from '../controllers/engagementController.js';

const router = express.Router();

// 4.8.5 Sửa đánh giá của mình - PATCH /ratings/:ratingId
router.patch('/:ratingId', authenticate, updateRating);

// 4.8.6 Xóa đánh giá của mình - DELETE /ratings/:ratingId
router.delete('/:ratingId', authenticate, deleteRating);

export default router;
