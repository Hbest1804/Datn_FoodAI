// src/services/authService.js
// Business logic cho chức năng xác thực (Auth)
// Sử dụng Supabase Auth để quản lý email/password + JWT

import { supabase, supabaseAdmin } from '../config/supabase.js';

/**
 * Đăng ký tài khoản mới.
 * - Tạo user trong auth.users (Supabase Auth)
 * - Tạo hồ sơ mở rộng trong bảng `users` và `user_profiles`
 * @returns {{ user, session }} hoặc throw Error
 */
export async function registerUser({ email, password, displayName, phone }) {
  // 1. Tạo user trong Supabase Auth
  // 1. Tạo user qua Admin API (auto-confirm email để dùng ngay)
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (adminError) {
    if (adminError.message.toLowerCase().includes('already been registered') ||
      adminError.message.toLowerCase().includes('already exists') ||
      adminError.message.toLowerCase().includes('duplicate key') ||
      adminError.message.toLowerCase().includes('user already exists')) {
      throw new Error('EMAIL_EXISTS');
    }
    throw new Error(adminError.message);
  }

  const authUser = adminData.user;
  if (!authUser) {
    throw new Error('SIGNUP_FAILED');
  }

  // 2. Tạo hồ sơ mở rộng trong bảng `users`
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email,
      display_name: displayName || email.split('@')[0],
      role: 'user',
      status: 'active',
    });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    throw new Error(`Không thể tạo hồ sơ người dùng: ${profileError.message}`);
  }

  // 3. Tạo user_profiles
  const { error: upError } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      user_id: authUser.id,
      household_size: 1,
      taste_prefs: {},
    });

  if (upError) {
    console.warn('Không tạo được user_profiles:', upError.message);
  }

  // 4. Sign in ngay để lấy session (vì đã auto-confirm)
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.warn('Không lấy được session sau đăng ký:', signInError.message);
  }

  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      displayName: displayName || email.split('@')[0],
      role: 'user',
    },
    session: signInData?.session ?? null,
  };
}

/**
 * Đăng nhập bằng email + mật khẩu.
 * @returns {{ user, session, accessToken, refreshToken }}
 */
export async function loginUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (
      error.message.includes('Invalid login credentials') ||
      error.message.includes('invalid_credentials')
    ) {
      throw new Error('INVALID_CREDENTIALS');
    }
    throw new Error(error.message);
  }

  const authUser = data.user;
  const session = data.session;

  // Lấy thêm role & status từ bảng users
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, role, status')
    .eq('id', authUser.id)
    .single();

  if (profileError) {
    throw new Error('Không thể lấy thông tin tài khoản.');
  }

  if (profile.status === 'locked') {
    throw new Error('ACCOUNT_LOCKED');
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      avatarUrl: authUser.user_metadata?.avatar_url || null,
      role: profile.role,
      status: profile.status,
    },
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  };
}

// Danh sách token đã bị thu hồi sau khi người dùng đăng xuất (In-memory token blacklist)
// Cấu trúc: Map<token, expiresAtTimestamp>
const revokedTokenMap = new Map();

// Tự động dọn dẹp các token đã quá hạn trong blacklist sau mỗi 30 phút
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of revokedTokenMap.entries()) {
    if (exp <= now) {
      revokedTokenMap.delete(token);
    }
  }
}, 30 * 60 * 1000).unref();

export function revokeToken(token, expiresAt = null) {
  if (!token || typeof token !== 'string') return;
  const exp = expiresAt ? expiresAt * 1000 : Date.now() + 24 * 60 * 60 * 1000;
  revokedTokenMap.set(token, exp);
}

export function isTokenRevoked(token) {
  if (!token) return false;
  return revokedTokenMap.has(token);
}

/**
 * Đăng xuất — vô hiệu hoá session phía Supabase và thu hồi token trong hệ thống.
 * @param {string|null} accessToken
 */
export async function logoutUser(accessToken) {
  if (accessToken) {
    // 1. Đưa token vào blocklist để chặn ngay lập tức trên mọi request tiếp theo
    revokeToken(accessToken);

    // 2. Thu hồi session phía Supabase GoTrue Auth qua Admin API
    try {
      await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
    } catch (error) {
      console.warn('Supabase admin signOut warning:', error.message);
    }
  }

  return { success: true };
}

/**
 * Lấy thông tin user hiện tại từ JWT.
 * @param {string} accessToken
 */
export async function getMe(accessToken) {
  // Xác thực token với Supabase
  const { data: { user: authUser }, error } = await supabase.auth.getUser(accessToken);

  if (error || !authUser) {
    throw new Error('TOKEN_INVALID');
  }

  // Lấy profile mở rộng
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, role, status, created_at')
    .eq('id', authUser.id)
    .single();

  if (profileError) {
    throw new Error('Không thể lấy thông tin tài khoản.');
  }

  if (profile.status === 'locked') {
    throw new Error('ACCOUNT_LOCKED');
  }

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    status: profile.status,
    createdAt: profile.created_at,
  };
}

/**
 * Refresh access token bằng refresh token.
 */
export async function refreshSession(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new Error('REFRESH_FAILED');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

/**
 * Yêu cầu đặt lại mật khẩu (gửi email).
 */
export async function requestPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(`Không thể gửi email đặt lại mật khẩu: ${error.message}`);
  }

  return { success: true };
}

/**
 * Kiểm tra tính hợp lệ của token.
 * Vì Supabase trả về access_token trên frontend, ta dùng nó như 'token' để gọi getUser.
 */
export async function verifyResetToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }
  return { valid: true };
}

/**
 * Đặt mật khẩu mới.
 * Sử dụng token (access_token từ email) để định danh user, sau đó dùng admin client đổi mật khẩu.
 */
export async function resetPassword(token, newPassword) {
  // Xác thực token trước
  const { data, error: userError } = await supabase.auth.getUser(token);

  if (userError || !data.user) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const userId = data.user.id;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Không thể cập nhật mật khẩu: ${error.message}`);
  }

  // Supabase tự động revoke toàn bộ session/refresh token cũ khi đổi mật khẩu qua admin.updateUserById()
  // KHÔNG gọi admin.signOut(userId) — hàm đó nhận JWT string, không nhận UUID.

  return { success: true };
}
