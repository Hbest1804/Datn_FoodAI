// src/routes/ingredients.js
// 4.2.2 Tìm nguyên liệu (gợi ý khi gõ)

import { Router } from 'express';
import { getIngredients } from '../controllers/ingredientsController.js';
import { publicReadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/', publicReadLimiter, getIngredients);

export default router;
