// src/config/appConfig.js
// Load và validate tất cả biến môi trường từ .env

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
  if (!m) return 'gemini-3.8-flash';
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

  guestChatLimit: parseInt(process.env.GUEST_CHAT_LIMIT ?? '5', 10),

  adminSeed: {
    email: (process.env.ADMIN_EMAIL || process.env.ADMIN_USER || process.env.Admin_User || '').trim(),
    password: (process.env.ADMIN_PASSWORD || process.env.Password || '').trim(),
    role: (process.env.ADMIN_ROLE || process.env.role || 'admin').trim().toLowerCase(),
    displayName: (process.env.ADMIN_NAME || 'Quản trị viên').trim(),
  },
};
