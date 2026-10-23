// src/server.js
// Entry point chính của backend Express

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/appConfig.js';
import { testDbConnection } from './config/supabase.js';
import { ensureAdminUser } from './services/adminInitService.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import ingredientsRoutes from './routes/ingredients.js';
import dishesRoutes from './routes/dishes.js';
import chatRoutes from './routes/chat.js';
import meRoutes from './routes/me.js';
import ratingsRoutes from './routes/ratings.js';
import adminRoutes from './routes/admin.js';

const app = express();

// ── Security & Middleware ─────────────────────────────────────────────────────
// Sử dụng Helmet để thiết lập các HTTP headers bảo mật
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: env.corsOrigin.split(',').map(o => o.trim()),
  credentials: true,
}));

// Giới hạn dung lượng request body JSON ở mức 1MB hợp lý, tránh rủi ro DoS tràn bộ nhớ
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Chuẩn hóa toàn bộ REST API tập trung dưới tiền tố /api
app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/ingredients', ingredientsRoutes);
app.use('/api/dishes', dishesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/me', meRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api', adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route không tồn tại',
    },
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Chuẩn hóa định dạng lỗi theo mục 2.2 của tài liệu đặc tả API
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('🔥 Server error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'Tệp tải lên vượt quá dung lượng cho phép.' },
    });
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const isProd = env.nodeEnv === 'production';
  // Không làm lộ stack trace hoặc thông tin CSDL nội bộ ra client khi gặp lỗi 500
  const safeMessage = (status === 500 && isProd)
    ? 'Đã xảy ra lỗi nội bộ phía máy chủ. Vui lòng thử lại sau.'
    : (err.message || 'Lỗi server nội bộ');

  res.status(status).json({
    success: false,
    error: {
      code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: safeMessage,
      ...(err.details ? { details: err.details } : {}),
    },
  });
});

// ── Khởi động ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await testDbConnection();          // ping Supabase trước khi lắng nghe
    await ensureAdminUser();           // tự động kiểm tra và tạo tài khoản admin nếu chưa có

    app.listen(env.port, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${env.port}`);
      console.log(`   Môi trường : ${env.nodeEnv}`);
      console.log(`   CORS origin: ${env.corsOrigin}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

bootstrap();
