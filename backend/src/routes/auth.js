// src/routes/auth.js
// 4.1 Xác thực & tài khoản

import { Router } from 'express';
import {
  login,
  logout,
  me,
  refresh,
  register,
  requestPasswordReset,
  resetPassword,
  verifyPasswordReset,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authLimiter, forgotPasswordLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.use(authLimiter);

router.post('/register', register);                          // 4.1.1
router.post('/login', login);                                // 4.1.2
router.post('/logout', authenticate, logout);                // 4.1.3
router.post('/refresh', refresh);                            // 4.1.4
router.post('/forgot-password', forgotPasswordLimiter, requestPasswordReset); // 4.1.5
router.post('/reset-password/verify', verifyPasswordReset);  // 4.1.6
router.post('/reset-password', resetPassword);               // 4.1.7
router.get('/me', authenticate, me);                         // tiện ích: người dùng hiện tại

export default router;
