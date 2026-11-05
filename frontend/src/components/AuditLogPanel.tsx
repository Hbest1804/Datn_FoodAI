import React, { useEffect, useState } from 'react';
import { FileText, Loader2, ChevronLeft, ChevronRight, RotateCcw, Filter } from 'lucide-react';
import { apiService } from '../api';

// Nhật ký thao tác của Admin (FR-41): lọc theo Admin thực hiện, hành động và khoảng thời gian.
// Mã hành động khớp với các lệnh recordAuditLog ở backend.
const ACTION_LABELS: Record<string, string> = {
  'user.lock': 'Khoá tài khoản',
  'user.unlock': 'Mở khoá tài khoản',
  'user.role_change': 'Đổi vai trò',
  'user.delete': 'Xoá tài khoản',
  'dish.create': 'Thêm món',
  'dish.update': 'Sửa món',
  'dish.hide': 'Ẩn món',
  'dish.delete': 'Xoá món',
  'dish.publish': 'Công khai món',
  'dish.unpublish': 'Ẩn món khỏi người dùng',
  'dish.import': 'Nhập món từ file',
  'recipe.create': 'Thêm công thức',
  'recipe.update': 'Sửa công thức',
  'recipe.delete': 'Xoá công thức',
  'recipe.import': 'Nhập công thức từ file',
  'ingredient.import': 'Nhập nguyên liệu từ file',
  'rating.delete': 'Xoá đánh giá',
  'chatbot.flag': 'Gắn cờ câu trả lời',
  'chatbot.unflag': 'Bỏ gắn cờ câu trả lời',
  'chatbot.settings_update': 'Cập nhật cấu hình chatbot',
};

const ACTION_TONES: Record<string, string> = {
  lock: 'bg-red-50 text-red-700',
  delete: 'bg-red-50 text-red-700',
  unlock: 'bg-emerald-50 text-emerald-700',
  publish: 'bg-emerald-50 text-emerald-700',
  create: 'bg-emerald-50 text-emerald-700',
  import: 'bg-amber-50 text-amber-800',
  flag: 'bg-amber-50 text-amber-800',
  role_change: 'bg-violet-50 text-violet-700',
  hide: 'bg-slate-100 text-slate-700',
  unpublish: 'bg-slate-100 text-slate-700',
};

const TARGET_LABELS: Record<string, string> = {
  user: 'Người dùng',
  dish: 'Món',
  rating: 'Đánh giá',
  chat_message: 'Tin nhắn chatbot',
  app_settings: 'Cấu hình hệ thống',
  ingredient: 'Nguyên liệu',
};

const DETAIL_LABELS: Record<string, string> = {
  reason: 'Lý do',
  name: 'Tên',
  email: 'Email',
  display_name: 'Tên hiển thị',
  fields: 'Trường đã sửa',
  file_name: 'File',
  created_count: 'Đã tạo',
  replaced_count: 'Ghi đè',
  error_dishes: 'Món lỗi',
  rating_count: 'Số đánh giá',
  publish: 'Công khai món',
  on_existing: 'Món đã có công thức',
  created_ids: 'Số món thêm mới',
  replaced_ids: 'Số món ghi đè',
  skipped_ids: 'Số món bỏ qua',
  new_ingredients: 'Nguyên liệu mới',
  new_group_count: 'Số liên kết nhóm mới',
  dish_hidden: 'Ẩn món',
  status: 'Trạng thái',
  published: 'Công khai',
  published_ids: 'Số món công khai',
  skipped_count: 'Số món bỏ qua',
  dish_ids: 'Số món',
  total_dishes: 'Tổng số món',
  valid_dishes: 'Món hợp lệ',
};

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDate(new Date(Date.now() - n * DAY_MS));

function actionTone(action: string) {
  const verb = action.split('.').slice(1).join('.');
  return ACTION_TONES[verb] || 'bg-sky-50 text-sky-700';
}

function describeDetail(detail: any): string {
  if (detail == null || detail === '') return '—';
  if (typeof detail !== 'object') return String(detail);
  if ('from' in detail && 'to' in detail) {
    return `Vai trò: ${detail.from} → ${detail.to}${detail.email ? ` (${detail.email})` : ''}`;
  }
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      const label = DETAIL_LABELS[k] || k;
      // Danh sách mã (created_ids, replaced_ids…) chỉ hiện số lượng, không in từng uuid
      if (Array.isArray(v) && /_ids$|^ids$/.test(k)) return `${label}: ${v.length}`;
      if (k === 'on_existing') return `${label}: ${v === 'replace' ? 'Ghi đè' : 'Bỏ qua'}`;
      if (typeof v === 'boolean') return `${label}: ${v ? 'có' : 'không'}`;
      if (Array.isArray(v)) return `${label}: ${v.length > 5 ? `${v.slice(0, 5).join(', ')} … (+${v.length - 5})` : v.join(', ')}`;
      if (typeof v === 'object') return `${label}: ${JSON.stringify(v)}`;
      return `${label}: ${v}`;
    });
  return parts.length ? parts.join(' • ') : '—';
}

// Tab "Nhật ký thao tác" trong Cổng quản trị (/admin?tab=audit)
export const AuditLogPanel: React.FC = () => {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(isoDate(new Date()));
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (p = page, f = { actorId, action, from, to }) => {
    if (f.from && f.to) {
      const span = (Date.parse(f.to) - Date.parse(f.from)) / DAY_MS;
      if (span < 0) { setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'); return; }
      if (span > 366) { setError('Khoảng thời gian tối đa là 366 ngày.'); return; }
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiService.admin.getAuditLogs({
        page: p,
        limit: PAGE_SIZE,
        actor_id: f.actorId || undefined,
        action: f.action || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      });
      setLogs(res.data || []);
      setTotal(res.meta?.total ?? (res.data || []).length);
      setPage(p);
    } catch (err: any) {
      setError(err?.message || 'Không tải được nhật ký thao tác.');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    apiService.admin.getUsers({ role: 'admin', limit: 100 })
      .then((res: any) => setAdmins((res?.data || [])
        .filter((u: any) => !u.role || u.role === 'admin')
        .map((u: any) => ({ id: u.id, name: u.display_name || u.email || u.id }))))
      .catch(() => setAdmins([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuickRange = (days: number) => {
    const f = { actorId, action, from: daysAgo(days), to: isoDate(new Date()) };
    setFrom(f.from);
    setTo(f.to);
    load(1, f);
  };

  const resetFilters = () => {
    const f = { actorId: '', action: '', from: daysAgo(30), to: isoDate(new Date()) };
    setActorId(''); setAction(''); setFrom(f.from); setTo(f.to);
    load(1, f);
  };

  const activeQuick = [7, 30, 90].find(d => from === daysAgo(d) && to === isoDate(new Date()));
  const fieldClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-800 outline-none';

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Quản trị & bảo mật • FR-41</span>
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 mt-1">
          <FileText className="w-6 h-6 text-orange-500" />
          Nhật Ký Thao Tác Quản Trị
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Mọi thao tác thay đổi dữ liệu của Admin đều được ghi lại. Nhật ký chỉ để xem, không sửa hoặc xoá được.
        </p>
      </div>
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">

        {/* Bộ lọc (FR-41) */}
        <form
          onSubmit={(e) => { e.preventDefault(); load(1); }}
          className="p-4 bg-slate-50/60 border border-slate-200/80 rounded-2xl space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto] gap-3 items-end">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Admin thực hiện</span>
              <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={fieldClass}>
                <option value="">Tất cả Admin</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Hành động</span>
              <select value={action} onChange={(e) => setAction(e.target.value)} className={fieldClass}>
                <option value="">Tất cả hành động</option>
                {Object.entries(ACTION_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Từ ngày</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Đến ngày</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
              >
                <Filter className="w-3.5 h-3.5" /> Lọc
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">Nhanh:</span>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => applyQuickRange(d)}
                className={`px-3 py-1 rounded-full font-bold cursor-pointer transition-colors ${
                  activeQuick === d ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {d} ngày
              </button>
            ))}
            <span className="ml-auto font-semibold text-slate-600">{total} bản ghi phù hợp</span>
          </div>
          {error && <div className="text-xs font-semibold text-red-600">{error}</div>}
        </form>

        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
              <tr>
                <th className="py-2.5 pl-3">Thời gian</th>
                <th className="py-2.5">Admin thực hiện</th>
                <th className="py-2.5">Hành động</th>
                <th className="py-2.5">Đối tượng</th>
                <th className="py-2.5 pr-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-1" />
                    Đang tải nhật ký thao tác...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Không có bản ghi nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 align-top">
                    <td className="py-2.5 pl-3 text-slate-700 whitespace-nowrap">
                      {log.created_at ? (
                        <>
                          <div className="font-semibold">{new Date(log.created_at).toLocaleDateString('vi-VN')}</div>
                          <div className="font-mono text-[11px] text-slate-400">{new Date(log.created_at).toLocaleTimeString('vi-VN')}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-800">{log.actor?.display_name || 'Không rõ'}</td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${actionTone(log.action)}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600">
                      <div className="font-semibold text-slate-700">{TARGET_LABELS[log.target_type] || log.target_type || '—'}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600 text-[11px] break-words max-w-xs">{describeDetail(log.detail)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-slate-500">
            {total > 0 ? `Hiển thị ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} trong ${total} bản ghi` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={loading || page <= 1}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg cursor-pointer"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700">Trang {page}/{totalPages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={loading || page >= totalPages}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg cursor-pointer"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPanel;
