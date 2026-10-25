// src/server.js
// Điểm khởi chạy chính của máy chủ Express

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/appConfig.js';
import { testDbConnection } from './config/supabase.js';
import { ensureAdminUser } from './services/adminInitService.js';
import { indexStaleDishes } from './services/embeddingService.js';
import { getPublishedDishes } from './services/cacheService.js';
import { getFilterData } from './controllers/metaController.js';
import { requestIdMiddleware, sendError } from './utils/http.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import ingredientsRoutes from './routes/ingredients.js';
import dishesRoutes from './routes/dishes.js';
import interactionsRoutes from './routes/interactions.js';
import chatRoutes from './routes/chat.js';
import meRoutes from './routes/me.js';
import ratingsRoutes from './routes/ratings.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestIdMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, timestamp: new Date().toISOString() });
});

// ── Đăng ký các nhóm API ──────────────────────────────────────────────────────
// Địa chỉ gốc theo tài liệu: /api
const api = express.Router();
api.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, timestamp: new Date().toISOString() });
});
api.use('/auth', authRoutes);
api.use('/meta', metaRoutes);
api.use('/ingredients', ingredientsRoutes);
api.use('/dishes', dishesRoutes);
api.use('/interactions', interactionsRoutes);
api.use('/chat', chatRoutes);
api.use('/me', meRoutes);
api.use('/ratings', ratingsRoutes);
api.use('/admin', adminRoutes);

app.use('/api', api);

// ── Đường dẫn không tồn tại ──────────────────────────────────────────────────
app.use((_req, res) => sendError(res, 404, 'NOT_FOUND', 'Đường dẫn API không tồn tại.'));

// ── Xử lý lỗi chung (mục 2.2, 2.5) ───────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (res.headersSent) return undefined;

  // Dữ liệu JSON gửi lên sai cú pháp
  if (err.type === 'entity.parse.failed') return sendError(res, 400, 'INVALID_QUERY', 'Body JSON không hợp lệ.');
  if (err.type === 'entity.too.large') return sendError(res, 413, 'FILE_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.');

  // Lỗi nghiệp vụ (ApiError) và lỗi dịch vụ AI (AIServiceError) đã có sẵn mã trạng thái và mã lỗi
  if (err.name === 'ApiError' || err.name === 'AIServiceError') {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  // Ràng buộc trong CSDL: món hiển thị phải có công thức
  if (typeof err.message === 'string' && err.message.includes('RECIPE_REQUIRED')) {
    return sendError(res, 422, 'RECIPE_REQUIRED', 'Món chưa có công thức hợp lệ nên chưa thể hiển thị.');
  }

  console.error(`🔥 [${req.id}] Server error:`, err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.');
});

// ── Khởi động ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await testDbConnection();

    app.listen(env.port, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${env.port}/api`);
      console.log(`   Môi trường : ${env.nodeEnv}`);
      console.log(`   CORS origin: ${env.corsOrigin}`);
    });

    // Không cần chờ: tạo tài khoản admin và nạp sẵn danh sách món để lượt tải trang đầu tiên không phải đợi CSDL
    ensureAdminUser();
    Promise.all([getPublishedDishes(), getFilterData()])
      .catch((err) => console.warn('[Cache] Không nạp sẵn được danh sách món:', err.message));

    // Tạo véc-tơ cho các món chưa có hoặc đã đổi nội dung (chạy nền)
    indexStaleDishes()
      .then((n) => { if (n > 0) console.log(`🧭 Đã cập nhật véc-tơ cho ${n} món.`); })
      .catch((err) => console.warn('[Embedding] Không tạo được véc-tơ món khi khởi động:', err.message));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

bootstrap();
