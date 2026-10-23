// src/services/settingsService.js
// Đọc/ghi bảng app_settings (cấu hình chatbot, trọng số gợi ý, ngưỡng chủ đề) – mục 4.12.4, 4.12.5

import { supabaseAdmin } from '../config/supabase.js';

// Giá trị mặc định trùng với dữ liệu khởi tạo trong lược đồ CSDL
export const DEFAULT_SETTINGS = {
  guest_message_limit: 10,
  guest_window_hours: 24,
  system_prompt: 'Bạn là "Trợ lý ẩm thực" của website gợi ý món ăn Việt Nam.',
  max_context_dishes: 8,
  recommendation_weights: { sim: 0.45, rating: 0.2, pop: 0.15, budget: 0.1, cal: 0.1 },
  topic_threshold_low: 0.45,
  topic_threshold_high: 0.6,
};

const CACHE_TTL_MS = 30 * 1000;
let cache = null;

export async function getSettings() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const { data, error } = await supabaseAdmin.from('app_settings').select('key, value, updated_by, updated_at');
  if (error) {
    console.warn('[Settings] Không đọc được app_settings, dùng giá trị mặc định:', error.message);
    return { ...DEFAULT_SETTINGS, _meta: {} };
  }

  const value = { ...DEFAULT_SETTINGS, _meta: {} };
  for (const row of data || []) {
    value[row.key] = row.value;
    value._meta[row.key] = { updated_by: row.updated_by, updated_at: row.updated_at };
  }
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/**
 * Ghi nhiều khóa cùng lúc; có hiệu lực ngay cho lượt hỏi sau (xóa bộ nhớ đệm).
 */
export async function updateSettings(patch, updatedBy) {
  const now = new Date().toISOString();
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value,
    updated_by: updatedBy || null,
    updated_at: now,
  }));
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  }
  cache = null;
  return getSettings();
}
