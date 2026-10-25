// src/routes/interactions.js
// 5.1.2 Ghi nhận tương tác

import { Router } from 'express';
import { createInteraction } from '../controllers/interactionsController.js';
import { optionalAuthenticate } from '../middlewares/authMiddleware.js';
import { publicReadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/', publicReadLimiter, optionalAuthenticate, createInteraction);

export default router;
