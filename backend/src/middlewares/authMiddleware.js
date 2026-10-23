// src/middlewares/authMiddleware.js
// Xác thực mã truy cập (Bearer) do Supabase cấp – mục 2.1 của tài liệu API

import { supabase, supabaseAdmin } from '../config/supabase.js';
import { decodeJwtExp, isTokenRevoked } from '../services/authService.js';
import { sendError } from '../utils/http.js';

/**
 * Trả về { user } nếu mã truy cập hợp lệ, ngược lại trả { status, code, message } mô tả lỗi.
 */
async function resolveUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'Chưa đăng nhập. Vui lòng đăng nhập.' };
  }
  const token = header.slice(7);
  if (isTokenRevoked(token)) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.' };
  }
  // Mã truy cập hết hạn → 401 TOKEN_EXPIRED để giao diện gọi POST /auth/refresh
  const exp = decodeJwtExp(token);
  if (exp && exp * 1000 <= Date.now()) {
    return { status: 401, code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' };
  }

  const { data: { user: authUser } = {}, error } = await supabase.auth.getUser(token);
  if (error || !authUser) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'Token không hợp lệ.' };
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, avatar_url, role, status, created_at')
    .eq('id', authUser.id)
    .maybeSingle();
  if (!profile) return { status: 401, code: 'UNAUTHORIZED', message: 'Tài khoản không tồn tại.' };
  if (profile.status === 'locked') {
    return { status: 403, code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa.' };
  }
  return { user: { ...profile, accessToken: token } };
}

/** Bắt buộc đăng nhập; gắn req.user. */
export async function authenticate(req, res, next) {
  try {
    const result = await resolveUser(req);
    if (!result.user) return sendError(res, result.status, result.code, result.message);
    req.user = result.user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Chỉ Admin (dùng sau authenticate). */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'Bạn không có quyền truy cập khu vực này.');
  }
  next();
}

/** Không bắt buộc đăng nhập: có token hợp lệ thì gắn req.user, ngược lại req.user = null. */
export async function optionalAuthenticate(req, _res, next) {
  try {
    const result = req.headers.authorization ? await resolveUser(req) : {};
    req.user = result.user || null;
  } catch {
    req.user = null;
  }
  next();
}
