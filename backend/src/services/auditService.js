// src/services/auditService.js
// Ghi nhật ký thao tác của Admin vào bảng audit_logs (mục 4.11.6 của tài liệu API)

import { supabaseAdmin } from '../config/supabase.js';

/**
 * Ghi một dòng nhật ký thao tác; ghi lỗi thì chỉ cảnh báo, không chặn luồng chính.
 * actor là người dùng đang đăng nhập; action ví dụ: user.lock, user.role_change, dish.delete, dish.import
 */
export async function recordAuditLog(actor, action, targetType, targetId, detail = {}) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: actor?.id || null,
    action,
    target_type: targetType,
    target_id: targetId != null ? String(targetId) : null,
    detail,
  });
  if (error) console.warn('[Audit] Không ghi được audit_logs:', error.message);
}
