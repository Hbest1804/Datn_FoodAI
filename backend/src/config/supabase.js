// src/config/supabase.js
// Tạo 2 Supabase client:
//   - supabase      : dùng anon key, cho các query public / RLS-protected
//   - supabaseAdmin : dùng service role key, BỎ QUA RLS – chỉ dùng ở backend

import { createClient } from '@supabase/supabase-js';
import { env } from './appConfig.js';

/**
 * Client thông thường (anon key).
 * Tuân thủ Row Level Security → an toàn để dùng khi cần kiểm tra quyền user.
 */
export const supabase = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      persistSession: false,   // backend không lưu session vào localStorage
      autoRefreshToken: false,
    },
  }
);

/**
 * Admin client (service role key).
 * BỎ QUA Row Level Security – chỉ dùng cho các tác vụ quản trị nội bộ.
 * TUYỆT ĐỐI không để key này lộ ra frontend.
 */
export const supabaseAdmin = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Kiểm tra kết nối DB khi khởi động server.
 * Trả về true nếu ping thành công, throw Error nếu thất bại.
 */
export async function testDbConnection() {
  const { error } = await supabaseAdmin
    .from('users')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`❌ Không thể kết nối Supabase: ${error.message}`);
  }
  return true;
}
