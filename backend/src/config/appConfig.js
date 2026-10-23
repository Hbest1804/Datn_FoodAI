// src/config/appConfig.js
// Đọc và kiểm tra tất cả biến môi trường từ tệp .env

import 'dotenv/config';

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`❌ Thiếu biến môi trường bắt buộc: ${key}`);
  }
}

function normalizeGeminiModel(m) {
  if (!m) return 'gemini-3.5-flash-lite';
  const cleaned = m.trim().toLowerCase().replace(/\s+/g, '-');
  return cleaned;
}

function normalizeGeminiEmbeddingModel(m) {
  if (!m) return 'gemini-embedding-2';
  return m.trim().toLowerCase().replace(/\s+/g, '-');
}

export const env = {
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: normalizeGeminiModel(process.env.GEMINI_MODEL),
    embeddingModel: normalizeGeminiEmbeddingModel(process.env.GEMINI_EMBEDDING_MODEL),
  },

  // Địa chỉ giao diện dùng cho liên kết trong email: địa chỉ đầu tiên trong CORS_ORIGIN
  frontendUrl: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, ''),

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    // true khi dùng cổng 465 (SSL); không đặt thì tự suy ra theo cổng
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost',
  },

  adminSeed: {
    email: (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || process.env.Admin_User || '').trim(),
    password: (process.env.ADMIN_PASSWORD || process.env.Password || '').trim(),
    role: (process.env.ADMIN_ROLE || process.env.role || 'admin').trim().toLowerCase(),
    displayName: (process.env.ADMIN_NAME || 'Quản trị viên').trim(),
  },
};
