// src/controllers/meController.js
// Tài khoản & dữ liệu cá nhân – mục 4.9 và 5.5 của tài liệu API

import { supabaseAdmin } from '../config/supabase.js';
import { verifyPassword } from '../services/authService.js';
import { invalidateRecommendationCache, toDishSummary } from '../services/recommendationService.js';
import { recomputeUserVectorsInBackground } from '../services/embeddingService.js';
import { passwordErrors } from './authController.js';
import { inspectImage } from '../utils/image.js';
import { matchesSearchKeyword } from '../utils/textUtils.js';
import {
  pageMeta,
  parseBool,
  parsePagination,
  requireConfirm,
  sendError,
  sendOk,
} from '../utils/http.js';

const DISH_CARD = 'id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count';

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
  };
}

/**
 * 4.9.1 Xem thông tin tài khoản – GET /me
 */
export async function getMe(req, res) {
  const userId = req.user.id;
  const count = (table) => supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  const [favs, ratings, sessions] = await Promise.all([count('favorites'), count('ratings'), count('chat_sessions')]);
  return sendOk(res, {
    ...publicUser(req.user),
    stats: { favorites: favs.count || 0, ratings: ratings.count || 0, chat_sessions: sessions.count || 0 },
  });
}

/**
 * 4.9.2 Cập nhật thông tin tài khoản – PATCH /me (chỉ display_name)
 */
export async function updateMe(req, res) {
  const name = typeof req.body?.display_name === 'string' ? req.body.display_name.trim() : '';
  if (!name || name.length > 100) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Tên hiển thị không được để trống và tối đa 100 ký tự.', [
      { field: 'display_name', code: name ? 'TOO_LONG' : 'REQUIRED', message: 'Tên hiển thị 1–100 ký tự.' },
    ]);
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ display_name: name })
    .eq('id', req.user.id)
    .select('id, email, display_name, avatar_url, role, status, created_at')
    .single();
  if (error) throw error;
  return sendOk(res, data);
}

/**
 * 4.9.3 Đổi mật khẩu – PUT /me/password. Các phiên khác bị hủy, phiên hiện tại được giữ.
 */
export async function changePassword(req, res) {
  const body = req.body || {};
  const current = body.current_password ?? body.old_password;
  const details = passwordErrors(body.new_password, body.confirm_password, 'new_password');
  if (typeof current !== 'string' || !current) {
    details.unshift({ field: 'current_password', code: 'REQUIRED', message: 'Vui lòng nhập mật khẩu hiện tại.' });
  }
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới không hợp lệ hoặc không khớp.', details);

  if (!(await verifyPassword(req.user.email, current))) {
    return sendError(res, 400, 'WRONG_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng.', [
      { field: 'current_password', code: 'WRONG_PASSWORD', message: 'Mật khẩu hiện tại không đúng.' },
    ]);
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: body.new_password });
  if (error) throw error;
  await supabaseAdmin.auth.admin.signOut(req.user.accessToken, 'others').catch(() => {});
  return sendOk(res, { message: 'Đổi mật khẩu thành công.' });
}

/**
 * 4.9.4 Danh sách món yêu thích – GET /me/favorites?q=&page=&limit=
 */
export async function getMyFavorites(req, res) {
  const pg = parsePagination(req.query);
  const keyword = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const { data, error } = await supabaseAdmin
    .from('favorites')
    .select(`created_at, dish:dishes(${DISH_CARD}, is_published)`)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data || []).filter((f) => f.dish?.is_published && (!keyword || matchesSearchKeyword(f.dish.name, keyword)));
  const items = rows.slice(pg.from, pg.to + 1).map((f) => ({ ...toDishSummary(f.dish, true), favorited_at: f.created_at }));
  return sendOk(res, items, { meta: pageMeta(pg, rows.length) });
}

/**
 * 5.5.1 Xóa toàn bộ danh sách yêu thích – DELETE /me/favorites?confirm=true
 */
export async function clearMyFavorites(req, res) {
  requireConfirm(req.query.confirm);
  const { data, error } = await supabaseAdmin.from('favorites').delete().eq('user_id', req.user.id).select('dish_id');
  if (error) throw error;
  invalidateRecommendationCache(req.user.id);
  recomputeUserVectorsInBackground(req.user.id);
  return sendOk(res, { deleted: (data || []).length });
}

/**
 * 4.9.5 Tải ảnh đại diện – POST /me/avatar (multipart, trường file, jpg/png/webp, tối đa 2 MB)
 */
export async function uploadAvatar(req, res) {
  if (!req.file) return sendError(res, 422, 'VALIDATION_ERROR', 'Vui lòng chọn ảnh (trường file).');
  const info = inspectImage(req.file.buffer);
  if (!info) return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');

  const path = `${req.user.id}/${Date.now()}.${info.ext}`;
  const { error } = await supabaseAdmin.storage.from('avatars').upload(path, req.file.buffer, { contentType: info.mime, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);

  const { error: updErr } = await supabaseAdmin.from('users').update({ avatar_url: publicUrl }).eq('id', req.user.id);
  if (updErr) throw updErr;
  return sendOk(res, { avatar_url: publicUrl });
}

/**
 * Xóa tài khoản và dữ liệu cá nhân. Đánh giá được ẩn danh hóa nhờ ratings.user_id ON DELETE SET NULL;
 * các bảng dữ liệu cá nhân khác bị xóa dây chuyền theo users (users.id → auth.users.id ON DELETE CASCADE).
 */
export async function deleteUserAccount(userId) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error && !/not.?found/i.test(error.message)) throw error;
  // Phòng trường hợp không có ràng buộc tới auth.users (CSDL ngoài Supabase)
  await supabaseAdmin.from('users').delete().eq('id', userId);
}

/**
 * 4.9.6 Xóa tài khoản – DELETE /me { password, confirm: true }
 */
export async function deleteMe(req, res) {
  const { password, confirm } = req.body || {};
  if (parseBool(confirm) !== true) {
    return sendError(res, 400, 'CONFIRMATION_REQUIRED', 'Cần xác nhận confirm = true để xóa tài khoản.');
  }
  if (req.user.role === 'admin') {
    return sendError(res, 403, 'FORBIDDEN', 'Tài khoản Admin không tự xóa qua API này.');
  }
  if (typeof password !== 'string' || !(await verifyPassword(req.user.email, password))) {
    return sendError(res, 400, 'WRONG_CURRENT_PASSWORD', 'Mật khẩu xác nhận không đúng.');
  }
  await deleteUserAccount(req.user.id);
  return res.status(204).send();
}

/**
 * 5.5.2 Đánh giá của tôi – GET /me/ratings
 */
export async function getMyRatings(req, res) {
  const pg = parsePagination(req.query);
  const { data, count, error } = await supabaseAdmin
    .from('ratings')
    .select('id, stars, comment, created_at, dish:dishes(id, name, slug, image_url)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(pg.from, pg.to);
  if (error) throw error;
  return sendOk(res, data || [], { meta: pageMeta(pg, count) });
}

/**
 * 5.5.3 Lịch sử xem món – GET /me/view-history
 */
export async function getMyViewHistory(req, res) {
  const pg = parsePagination(req.query);
  const { data, count, error } = await supabaseAdmin
    .from('view_history')
    .select(`view_count, last_viewed_at, dish:dishes(${DISH_CARD})`, { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('last_viewed_at', { ascending: false })
    .range(pg.from, pg.to);
  if (error) throw error;
  return sendOk(res, (data || []).filter((v) => v.dish).map((v) => ({
    dish: toDishSummary(v.dish),
    view_count: v.view_count,
    last_viewed_at: v.last_viewed_at,
  })), { meta: pageMeta(pg, count) });
}

/**
 * 5.5.4 Xóa lịch sử xem – DELETE /me/view-history?confirm=true
 */
export async function clearMyViewHistory(req, res) {
  requireConfirm(req.query.confirm);
  const { data, error } = await supabaseAdmin.from('view_history').delete().eq('user_id', req.user.id).select('dish_id');
  if (error) throw error;
  invalidateRecommendationCache(req.user.id);
  recomputeUserVectorsInBackground(req.user.id);
  return sendOk(res, { deleted: (data || []).length });
}
