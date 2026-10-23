// src/controllers/adminUsersController.js
// Admin – Quản lý người dùng (mục 4.11, 5.8). Mọi thao tác thay đổi đều ghi vào audit_logs.

import { supabaseAdmin } from '../config/supabase.js';
import { recordAuditLog } from '../services/auditService.js';
import { invalidateRecommendationCache } from '../services/recommendationService.js';
import { deleteUserAccount } from './meController.js';
import { sanitizeSearchKeyword } from '../utils/validators.js';
import {
  UUID_REGEX,
  pageMeta,
  parseDateRange,
  parsePagination,
  requireConfirm,
  sendError,
  sendOk,
} from '../utils/http.js';

const USER_FIELDS = 'id, email, display_name, role, status, created_at';
const BAN_FOREVER = '876000h'; // khoảng 100 năm: không cấp lại mã đăng nhập cho tài khoản bị khóa

function userNotFound(res) {
  return sendError(res, 404, 'USER_NOT_FOUND', 'Người dùng không tồn tại.');
}

async function loadUser(userId) {
  const { data, error } = await supabaseAdmin.from('users').select(USER_FIELDS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Số Admin đang hoạt động khác `excludeId`. */
async function countOtherActiveAdmins(excludeId) {
  const { count } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'active')
    .neq('id', excludeId);
  return count || 0;
}

/**
 * Kiểm tra chung: không thao tác lên chính mình, không tác động Admin cuối cùng (luồng 4a).
 * Trả về true nếu đã trả lỗi cho người gọi.
 */
async function guardTarget(req, res, target, affectsAdmin) {
  if (target.id === req.user.id) {
    sendError(res, 403, 'CANNOT_MODIFY_SELF', 'Không thể thao tác lên chính tài khoản của bạn.');
    return true;
  }
  if (affectsAdmin && target.role === 'admin' && target.status === 'active' && (await countOtherActiveAdmins(target.id)) === 0) {
    sendError(res, 409, 'LAST_ADMIN', 'Không thể tác động lên Admin cuối cùng đang hoạt động.');
    return true;
  }
  return false;
}

/**
 * 4.11.1 Danh sách người dùng – GET /admin/users?q=&status=&role=&sort=&page=&limit=
 */
export async function adminGetUsers(req, res) {
  const pg = parsePagination(req.query);
  const { status, role } = req.query;
  const sort = req.query.sort ?? 'created_at';
  if (status && !['active', 'locked'].includes(status)) return sendError(res, 400, 'INVALID_QUERY', 'status phải là active hoặc locked.');
  if (role && !['user', 'admin'].includes(role)) return sendError(res, 400, 'INVALID_QUERY', 'role phải là user hoặc admin.');
  if (!['created_at', 'email', 'display_name'].includes(sort)) {
    return sendError(res, 400, 'INVALID_QUERY', 'sort phải là created_at, email hoặc display_name.');
  }

  let query = supabaseAdmin.from('users').select(USER_FIELDS, { count: 'exact' });
  const q = sanitizeSearchKeyword(req.query.q);
  if (q) query = query.or(`email.ilike.*${q}*,display_name.ilike.*${q}*`);
  if (status) query = query.eq('status', status);
  if (role) query = query.eq('role', role);
  query = query.order(sort, { ascending: sort !== 'created_at' }).range(pg.from, pg.to);

  const { data, count, error } = await query;
  if (error) throw error;
  return sendOk(res, data || [], { meta: pageMeta(pg, count) });
}

/**
 * 4.11.2 Chi tiết người dùng – GET /admin/users/:userId (không trả nội dung hội thoại)
 */
export async function adminGetUserDetail(req, res) {
  const user = await loadUser(req.params.userId);
  if (!user) return userNotFound(res);

  const count = (table) => supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const [favs, ratings, sessions, violations] = await Promise.all([
    count('favorites'),
    count('ratings'),
    count('chat_sessions'),
    // Số bình luận vi phạm đã bị Admin gỡ (5.8.1)
    supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true })
      .eq('action', 'rating.delete').eq('detail->>user_id', user.id),
  ]);
  return sendOk(res, {
    ...user,
    stats: {
      favorites: favs.count || 0,
      ratings: ratings.count || 0,
      chat_sessions: sessions.count || 0,
      violations: violations.count || 0,
    },
  });
}

/**
 * 4.11.3 Khóa / mở khóa – PATCH /admin/users/:userId/status { status, reason }
 * Khóa thì mọi phiên hiện có bị vô hiệu ngay (lớp xác thực chặn theo trạng thái, dịch vụ xác thực không cấp mã mới).
 */
export async function adminUpdateUserStatus(req, res) {
  const { status } = req.body || {};
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['active', 'locked'].includes(status)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'status phải là active hoặc locked.', [
      { field: 'status', code: 'INVALID_VALUE', message: 'active | locked' },
    ]);
  }
  if (status === 'locked' && !reason) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Vui lòng nhập lý do khóa tài khoản.', [
      { field: 'reason', code: 'REQUIRED', message: 'Lý do bắt buộc khi khóa.' },
    ]);
  }

  const target = await loadUser(req.params.userId);
  if (!target) return userNotFound(res);
  if (await guardTarget(req, res, target, status === 'locked')) return undefined;

  const { data, error } = await supabaseAdmin.from('users').update({ status }).eq('id', target.id).select('id, status').single();
  if (error) throw error;

  const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    ban_duration: status === 'locked' ? BAN_FOREVER : 'none',
  });
  if (banErr) console.warn('[Admin] Không cập nhật được trạng thái cấm trong Supabase Auth:', banErr.message);

  recordAuditLog(req.user, status === 'locked' ? 'user.lock' : 'user.unlock', 'user', target.id, {
    email: target.email,
    reason: reason || null,
  });
  return sendOk(res, data);
}

/**
 * 4.11.4 Đổi vai trò – PATCH /admin/users/:userId/role { role }
 */
export async function adminUpdateUserRole(req, res) {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'role phải là user hoặc admin.', [
      { field: 'role', code: 'INVALID_VALUE', message: 'user | admin' },
    ]);
  }
  const target = await loadUser(req.params.userId);
  if (!target) return userNotFound(res);
  if (await guardTarget(req, res, target, role === 'user')) return undefined;

  const { data, error } = await supabaseAdmin.from('users').update({ role }).eq('id', target.id).select('id, role').single();
  if (error) throw error;
  recordAuditLog(req.user, 'user.role_change', 'user', target.id, { email: target.email, from: target.role, to: role });
  return sendOk(res, data);
}

/**
 * 4.11.5 Xóa tài khoản – DELETE /admin/users/:userId?confirm=true
 */
export async function adminDeleteUser(req, res) {
  requireConfirm(req.query.confirm);
  const target = await loadUser(req.params.userId);
  if (!target) return userNotFound(res);
  if (await guardTarget(req, res, target, true)) return undefined;

  await deleteUserAccount(target.id);
  invalidateRecommendationCache(target.id);
  recordAuditLog(req.user, 'user.delete', 'user', target.id, { email: target.email, display_name: target.display_name });
  return res.status(204).send();
}

/**
 * 4.11.6 Nhật ký thao tác của Admin – GET /admin/audit-logs?actor_id=&action=&from=&to=&page=&limit=
 */
export async function adminGetAuditLogs(req, res) {
  const pg = parsePagination(req.query);
  const range = parseDateRange(req.query);
  if (req.query.actor_id && !UUID_REGEX.test(req.query.actor_id)) {
    return sendError(res, 400, 'INVALID_QUERY', 'actor_id phải là uuid.');
  }

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, action, target_type, target_id, detail, created_at, actor:users(id, display_name)', { count: 'exact' })
    .gte('created_at', range.fromIso)
    .lte('created_at', range.toIso);
  if (req.query.actor_id) query = query.eq('actor_id', req.query.actor_id);
  if (typeof req.query.action === 'string' && req.query.action.trim()) query = query.eq('action', req.query.action.trim());
  query = query.order('created_at', { ascending: false }).range(pg.from, pg.to);

  const { data, count, error } = await query;
  if (error) throw error;
  return sendOk(res, (data || []).map((l) => ({
    id: l.id,
    actor: l.actor || null,
    action: l.action,
    target_type: l.target_type,
    target_id: l.target_id,
    detail: l.detail,
    created_at: l.created_at,
  })), { meta: pageMeta(pg, count) });
}

/**
 * 5.8.1 Gỡ bình luận vi phạm – DELETE /admin/ratings/:ratingId (có ghi nhật ký)
 */
export async function adminDeleteRating(req, res) {
  const ratingId = Number(req.params.ratingId);
  if (!Number.isInteger(ratingId) || ratingId <= 0) return sendError(res, 404, 'RATING_NOT_FOUND', 'Đánh giá không tồn tại.');

  const { data: rating, error } = await supabaseAdmin
    .from('ratings')
    .select('id, user_id, dish_id, stars, comment')
    .eq('id', ratingId)
    .maybeSingle();
  if (error) throw error;
  if (!rating) return sendError(res, 404, 'RATING_NOT_FOUND', 'Đánh giá không tồn tại.');

  const { error: delErr } = await supabaseAdmin.from('ratings').delete().eq('id', rating.id);
  if (delErr) throw delErr;
  if (rating.user_id) invalidateRecommendationCache(rating.user_id);

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null;
  recordAuditLog(req.user, 'rating.delete', 'rating', rating.id, {
    user_id: rating.user_id,
    dish_id: rating.dish_id,
    stars: rating.stars,
    comment: rating.comment,
    reason,
  });
  return res.status(204).send();
}
