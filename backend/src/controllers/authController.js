// src/controllers/authController.js
// API xác thực – mục 4.1 của tài liệu API

import {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
  verifyResetToken,
} from '../services/authService.js';
import { isStrongPassword, isValidEmail } from '../utils/validators.js';
import { sendError, sendOk } from '../utils/http.js';

const WEAK_PASSWORD_MSG = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.';

/** Kiểm tra mật khẩu mới + xác nhận; trả về danh sách lỗi theo trường. */
export function passwordErrors(password, confirm, field = 'password') {
  const details = [];
  if (!isStrongPassword(password)) details.push({ field, code: 'WEAK_PASSWORD', message: WEAK_PASSWORD_MSG });
  if (password !== confirm) details.push({ field: 'confirm_password', code: 'PASSWORD_MISMATCH', message: 'Mật khẩu xác nhận không khớp.' });
  return details;
}

function bearerToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * 4.1.1 Đăng ký – POST /auth/register
 */
export async function register(req, res) {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = String(body.display_name ?? body.displayName ?? '').trim();
  // Giao diện cũ không gửi confirm_password thì coi như trùng mật khẩu
  const confirm = body.confirm_password ?? body.password;

  const details = [];
  if (!displayName) details.push({ field: 'display_name', code: 'REQUIRED', message: 'Vui lòng nhập tên hiển thị.' });
  else if (displayName.length > 100) details.push({ field: 'display_name', code: 'TOO_LONG', message: 'Tên hiển thị tối đa 100 ký tự.' });
  if (!isValidEmail(email)) details.push({ field: 'email', code: 'INVALID_EMAIL', message: 'Email không đúng định dạng.' });
  details.push(...passwordErrors(body.password, confirm));
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', details);

  const { user, session } = await registerUser({ email, password: body.password, displayName });
  return sendOk(res, {
    ...user,
    // Kèm phiên đăng nhập để giao diện vào hệ thống ngay sau khi đăng ký
    ...(session ? { access_token: session.access_token, refresh_token: session.refresh_token, token_type: 'bearer', expires_in: session.expires_in } : {}),
  }, { status: 201 });
}

/**
 * 4.1.2 Đăng nhập – POST /auth/login
 */
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Vui lòng nhập email và mật khẩu.', [
      ...(!email ? [{ field: 'email', code: 'REQUIRED', message: 'Vui lòng nhập email.' }] : []),
      ...(!password ? [{ field: 'password', code: 'REQUIRED', message: 'Vui lòng nhập mật khẩu.' }] : []),
    ]);
  }
  return sendOk(res, await loginUser({ email, password }));
}

/**
 * 4.1.3 Đăng xuất – POST /auth/logout → 204
 */
export async function logout(req, res) {
  await logoutUser(bearerToken(req));
  return res.status(204).send();
}

/**
 * GET /auth/me – thông tin người dùng hiện tại (tiện ích cho giao diện, tương đương GET /me nhưng không kèm số liệu)
 */
export async function me(req, res) {
  const { accessToken: _token, ...user } = req.user;
  return sendOk(res, user);
}

/**
 * 4.1.4 Làm mới mã truy cập – POST /auth/refresh
 */
export async function refresh(req, res) {
  const token = req.body?.refresh_token ?? req.body?.refreshToken;
  if (typeof token !== 'string' || !token) {
    return sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Thiếu refresh token. Vui lòng đăng nhập lại.');
  }
  return sendOk(res, await refreshSession(token));
}

/**
 * 4.1.5 Yêu cầu đặt lại mật khẩu – POST /auth/forgot-password
 */
export async function requestPasswordReset(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!isValidEmail(email)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Email sai định dạng.', [
      { field: 'email', code: 'INVALID_EMAIL', message: 'Email sai định dạng.' },
    ]);
  }
  await requestPasswordResetService(email);
  return sendOk(res, { message: 'Nếu email đã được đăng ký, mã đặt lại mật khẩu đã được gửi tới hộp thư của bạn.' });
}

/**
 * 4.1.6 Kiểm tra liên kết/mã đặt lại – POST /auth/reset-password/verify
 */
export async function verifyPasswordReset(req, res) {
  return sendOk(res, await verifyResetToken(req.body?.token));
}

/**
 * 4.1.7 Đặt mật khẩu mới – POST /auth/reset-password
 */
export async function resetPassword(req, res) {
  const { token, new_password: newPassword, confirm_password: confirm } = req.body || {};
  const details = passwordErrors(newPassword, confirm, 'new_password');
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Mật khẩu yếu hoặc không khớp phần xác nhận.', details);

  await resetPasswordService(token, newPassword);
  return sendOk(res, { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
}
