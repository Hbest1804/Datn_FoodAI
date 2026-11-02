// src/services/authService.js
// Nghiệp vụ xác thực – mục 4.1 của tài liệu API. Mật khẩu do dịch vụ xác thực của Supabase băm và lưu.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/appConfig.js';
import { ApiError } from '../utils/http.js';
import { sendPasswordResetEmail } from './mailService.js';

const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MINUTES = 15;
const RESET_TOKEN_MINUTES = 15;
const RESET_REQUESTS_PER_WINDOW = 3;

const USER_FIELDS = 'id, email, display_name, avatar_url, role, status, created_at';

/** Tạo kết nối riêng cho mỗi lần đăng nhập để các yêu cầu không dùng chung phiên đăng nhập. */
function freshClient() {
  return createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tokenPayload(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
  };
}

async function findUserByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`${USER_FIELDS}, failed_login_count, locked_until`)
    .ilike('email', email.replace(/[%_\\]/g, '\\$&'))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Kiểm tra mật khẩu bằng cách đăng nhập thử; đúng thì trả phiên đăng nhập, sai thì trả null. */
export async function verifyPassword(email, password) {
  const { data, error } = await freshClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return data.session;
}

// ── Thu hồi mã truy cập khi đăng xuất (mã vẫn hợp lệ tới khi hết hạn nên cần danh sách chặn) ──
const revokedTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of revokedTokens) if (exp <= now) revokedTokens.delete(token);
}, 30 * 60 * 1000).unref();

export function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenRevoked(token) {
  return Boolean(token) && revokedTokens.has(token);
}

function revokeAccessToken(token) {
  const exp = decodeJwtExp(token);
  revokedTokens.set(token, exp ? exp * 1000 : Date.now() + 60 * 60 * 1000);
}

// ── 4.1.1 Đăng ký ────────────────────────────────────────────────────────────

export async function registerUser({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (await findUserByEmail(normalizedEmail)) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký.');
  }

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký.');
    }
    throw error;
  }

  const { data: user, error: insertErr } = await supabaseAdmin
    .from('users')
    .insert({ id: created.user.id, email: normalizedEmail, display_name: displayName, role: 'user', status: 'active' })
    .select(USER_FIELDS)
    .single();
  if (insertErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw insertErr;
  }
  await supabaseAdmin.from('user_profiles').insert({ user_id: user.id });

  // Đăng nhập luôn để giao diện không phải gọi thêm /auth/login
  const session = await verifyPassword(normalizedEmail, password);
  return { user, session };
}

// ── 4.1.2 Đăng nhập (khóa 15 phút sau 5 lần sai liên tiếp – luồng 2c) ──────────

export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const retryAfter = Math.ceil((new Date(user.locked_until) - Date.now()) / 1000);
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', `Bạn đã nhập sai quá ${MAX_FAILED_LOGINS} lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút.`, { retry_after: retryAfter });
  }

  const { data, error } = await freshClient().auth.signInWithPassword({ email: normalizedEmail, password });

  if (error || !data.session) {
    if (user && /banned/i.test(error?.message || '')) {
      throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }
    if (user) {
      const failed = (user.failed_login_count || 0) + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await supabaseAdmin.from('users').update({
        failed_login_count: lock ? 0 : failed,
        locked_until: lock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString() : null,
      }).eq('id', user.id);
      if (lock) {
        throw new ApiError(429, 'TOO_MANY_ATTEMPTS', `Bạn đã nhập sai quá ${MAX_FAILED_LOGINS} lần. Vui lòng thử lại sau ${LOGIN_LOCK_MINUTES} phút.`, { retry_after: LOGIN_LOCK_MINUTES * 60 });
      }
    }
    // Không tiết lộ email có tồn tại hay không
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  }

  if (!user || user.status === 'locked') {
    await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'local').catch(() => {});
    if (!user) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
  }

  if (user.failed_login_count || user.locked_until) {
    await supabaseAdmin.from('users').update({ failed_login_count: 0, locked_until: null }).eq('id', user.id);
  }

  const { failed_login_count: _f, locked_until: _l, ...publicUser } = user;
  return { ...tokenPayload(data.session), user: publicUser };
}

// ── Đăng nhập bằng Google (OAuth qua Supabase Auth) ─────────────────────────

/** Địa chỉ trang đăng nhập Google của Supabase; đăng nhập xong Google chuyển về /auth/callback của giao diện. */
export function googleAuthorizeUrl() {
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: `${env.frontendUrl}/auth/callback`,
  });
  return `${env.supabase.url}/auth/v1/authorize?${params}`;
}

/**
 * Hoàn tất đăng nhập Google: kiểm tra mã truy cập Supabase vừa cấp, lần đầu thì tạo hồ sơ trong bảng users.
 * Google đã xác minh email nên không cần bước đăng ký riêng; email đã đăng ký bằng mật khẩu được Supabase gộp chung tài khoản.
 */
export async function completeGoogleLogin({ accessToken, refreshToken, expiresIn }) {
  const { data: { user: authUser } = {}, error } = await supabase.auth.getUser(accessToken);
  if (error || !authUser?.email) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Đăng nhập Google không thành công. Vui lòng thử lại.');
  }

  let { data: user, error: findErr } = await supabaseAdmin
    .from('users')
    .select(USER_FIELDS)
    .eq('id', authUser.id)
    .maybeSingle();
  if (findErr) throw findErr;

  if (!user) {
    const meta = authUser.user_metadata || {};
    const email = authUser.email.trim().toLowerCase();
    const displayName = String(meta.full_name || meta.name || email.split('@')[0]).trim().slice(0, 100);
    const { data: created, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({ id: authUser.id, email, display_name: displayName, avatar_url: meta.avatar_url || meta.picture || null, role: 'user', status: 'active' })
      .select(USER_FIELDS)
      .single();
    if (insertErr) {
      if (insertErr.code === '23505') {
        throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã gắn với một tài khoản khác. Vui lòng đăng nhập bằng mật khẩu.');
      }
      throw insertErr;
    }
    await supabaseAdmin.from('user_profiles').insert({ user_id: created.id });
    user = created;
  }

  if (user.status === 'locked') {
    await supabaseAdmin.auth.admin.signOut(accessToken, 'local').catch(() => {});
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
  }

  return {
    ...tokenPayload({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn }),
    user,
  };
}

// ── 4.1.3 Đăng xuất / 4.1.4 Làm mới mã truy cập ──────────────────────────────

export async function logoutUser(accessToken) {
  if (!accessToken) return;
  revokeAccessToken(accessToken);
  // Hủy phiên hiện tại → mã làm mới của phiên này hết hiệu lực
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'local');
  if (error) console.warn('[Auth] signOut:', error.message);
}

export async function refreshSession(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const { data: user } = await supabaseAdmin.from('users').select('status').eq('id', data.user.id).maybeSingle();
  if (!user || user.status === 'locked') {
    await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'global').catch(() => {});
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
  }
  return tokenPayload(data.session);
}

// ── 4.1.5 – 4.1.7 Đặt lại mật khẩu (mã 6 số, lưu SHA-256, hạn 15 phút, dùng một lần) ──

const resetRequestLog = new Map(); // email → danh sách thời điểm gửi yêu cầu

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // Giới hạn 3 yêu cầu / 15 phút cho mỗi email (luồng 4c); giới hạn theo IP nằm ở lớp chặn tần suất
  const now = Date.now();
  const recent = (resetRequestLog.get(normalizedEmail) || []).filter((t) => now - t < RESET_TOKEN_MINUTES * 60 * 1000);
  if (recent.length >= RESET_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((recent[0] + RESET_TOKEN_MINUTES * 60 * 1000 - now) / 1000);
    throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.', { retry_after: retryAfter });
  }
  resetRequestLog.set(normalizedEmail, [...recent, now]);

  const user = await findUserByEmail(normalizedEmail);
  // Chỉ gửi email khi tài khoản tồn tại và không bị khóa; kết quả trả về luôn giống nhau (luồng 4a)
  if (!user || user.status !== 'active') return;

  await supabaseAdmin.from('password_reset_tokens').delete().eq('user_id', user.id).is('used_at', null);

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const { error } = await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: hashToken(code),
      expires_at: new Date(now + RESET_TOKEN_MINUTES * 60 * 1000).toISOString(),
    });
    if (!error) break;
    if (error.code !== '23505') throw error; // trùng mã đang hiệu lực của người khác → sinh lại
    code = null;
  }
  if (!code) throw new Error('Không sinh được mã đặt lại mật khẩu');

  try {
    await sendPasswordResetEmail(user.email, code, `${env.frontendUrl}/reset-password?token=${code}`);
  } catch (err) {
    console.error('[Auth] Gửi email đặt lại mật khẩu thất bại:', err.message);
    throw new ApiError(502, 'EMAIL_SEND_FAILED', 'Không gửi được email. Vui lòng thử lại.');
  }
}

async function findValidResetToken(token) {
  if (!token || typeof token !== 'string') return null;
  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.used_at || new Date(data.expires_at) <= new Date()) return null;
  return data;
}

export async function verifyResetToken(token) {
  const row = await findValidResetToken(token);
  if (!row) throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  return { valid: true, expires_at: row.expires_at };
}

export async function resetPassword(token, newPassword) {
  const row = await findValidResetToken(token);
  if (!row) throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');

  const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: newPassword });
  if (error) throw error;

  await Promise.all([
    supabaseAdmin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id),
    supabaseAdmin.from('users').update({ failed_login_count: 0, locked_until: null }).eq('id', row.user_id),
  ]);

  // Hủy mọi phiên cũ: đăng nhập bằng mật khẩu mới để lấy một phiên rồi đăng xuất khỏi tất cả thiết bị
  const session = await verifyPassword(updated.user.email, newPassword);
  if (session) await supabaseAdmin.auth.admin.signOut(session.access_token, 'global').catch(() => {});
}
