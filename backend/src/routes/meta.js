// src/routes/meta.js
// 4.2.1 Dữ liệu tra cứu cho bộ lọc

import { Router } from 'express';
import { getFilters } from '../controllers/metaController.js';
import { optionalAuthenticate } from '../middlewares/authMiddleware.js';
import { publicReadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/filters', publicReadLimiter, optionalAuthenticate, getFilters);

export default router;
