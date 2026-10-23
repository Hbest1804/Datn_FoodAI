// src/controllers/authController.js
// Xử lý HTTP request/response cho các API xác thực

import {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  refreshSession,
  requestPasswordReset as requestPasswordResetService,
  verifyResetToken,
  resetPassword as resetPasswordService,
} from '../services/authService.js';
import { env } from '../config/appConfig.js';
import { isValidEmail, isStrongPassword } from '../utils/validators.js';

// Thời gian hiệu lực của reset token (phút) — đồng bộ với config Supabase Auth
const RESET_TOKEN_EXPIRES_MINUTES = 15;

// ── POST /api/auth/register ───────────────────────────────────────────────────
export async function register(req, res) {
  const { email, password, displayName, phone } = req.body;

  // Validate đầu vào
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email và mật khẩu là bắt buộc.' },
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email không đúng định dạng.' },
    });
  }

  // Thống nhất quy tắc mật khẩu mạnh dùng chung isStrongPassword
  if (!isStrongPassword(password)) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'WEAK_PASSWORD',
        message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.',
        details: [{ field: 'password', code: 'WEAK_PASSWORD', message: 'Mật khẩu phải có ít nhất 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.' }],
      },
    });
  }

  try {
    const result = await registerUser({ email, password, displayName, phone });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: result.user,
      // Trả token nếu Supabase auto-confirm (không cần verify email)
      accessToken: result.session?.access_token ?? null,
      refreshToken: result.session?.refresh_token ?? null,
    });
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS') {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.' },
      });
    }
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Đăng ký thất bại. Vui lòng thử lại sau.' },
    });
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email và mật khẩu là bắt buộc.' },
    });
  }

  try {
    const result = await loginUser({ email, password });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không chính xác.' },
      });
    }
    if (err.message === 'ACCOUNT_LOCKED') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_LOCKED', message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' },
      });
    }
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Đăng nhập thất bại. Vui lòng thử lại sau.' },
    });
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export async function logout(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    await logoutUser(token);
    return res.status(200).json({ message: 'Đăng xuất thành công.' });
  } catch (err) {
    console.error('Logout error:', err);
    // Vẫn trả 200 — client nên xóa token dù server có lỗi
    return res.status(200).json({ message: 'Đã đăng xuất.' });
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Lấy thông tin người dùng đang đăng nhập (cần Bearer token)
export async function me(req, res) {
  // req.user được gắn bởi authenticate middleware
  return res.status(200).json({ user: req.user });
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
export async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token là bắt buộc.' });
  }

  try {
    const result = await refreshSession(refreshToken);
    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'REFRESH_FAILED') {
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Không thể làm mới phiên.' });
  }
}

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
export async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email sai định dạng.' }
    });
  }

  try {
    const redirectTo = `${env.corsOrigin}/reset-password`;
    await requestPasswordResetService(email, redirectTo);
    return res.status(200).json({
      success: true,
      data: { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' }
    });
  } catch (err) {
    console.error('Request password reset error:', err);
    return res.status(200).json({
      success: true,
      data: { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' }
    });
  }
}

// ── POST /api/auth/reset-password/verify ──────────────────────────────────────
export async function verifyPasswordReset(req, res) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Token không hợp lệ hoặc hết hạn.' }
    });
  }

  try {
    const result = await verifyResetToken(token);
    // Tính expires_at (thực tế tuỳ vào token JWT chứa gì, nhưng có thể ước tính 15 phút nếu cần, 
    // hoặc chỉ trả về valid: true)
    return res.status(200).json({
      success: true,
      data: {
        valid: result.valid,
        expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60_000).toISOString(),
      }
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Token không hợp lệ hoặc đã hết hạn.' }
    });
  }
}

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
export async function resetPassword(req, res) {
  const { token, new_password, confirm_password } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Token không hợp lệ hoặc hết hạn.' }
    });
  }

  // Validate mật khẩu mới: tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số
  if (!new_password || !isStrongPassword(new_password)) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mật khẩu yếu hoặc không khớp phần xác nhận.',
        details: [
          { field: 'new_password', code: 'WEAK_PASSWORD', message: 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.' },
        ]
      }
    });
  }

  if (new_password !== confirm_password) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mật khẩu xác nhận không khớp.',
        details: [
          { field: 'confirm_password', code: 'PASSWORD_MISMATCH', message: 'Mật khẩu xác nhận không khớp.' },
        ]
      }
    });
  }

  try {
    await resetPasswordService(token, new_password);
    return res.status(200).json({
      success: true,
      data: { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' }
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Token không hợp lệ hoặc đã hết hạn.' }
    });
  }
}
