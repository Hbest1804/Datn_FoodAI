import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  UtensilsCrossed,
  BookOpen,
  Users,
  Bot,
  FileText,
  ArrowRight,
  X,
  LayoutGrid,
  ChevronUp,
} from 'lucide-react';
import type { AdminTab } from './adminTabs';

/**
 * Điều hướng Cổng quản trị trên điện thoại (ẩn từ màn lg trở lên, khi đó dùng sidebar bên trái).
 *  - Thanh dock nổi dưới đáy: ô "đang ở mục nào" + nút khối 3D mở menu
 *  - Bấm vào thì bảng menu bật lên kiểu lật 3D từ đáy, từng mục lần lượt lật vào
 * Render qua portal ra <body> để position: fixed không bị các khung có transform (hiệu ứng 3D) giữ lại.
 */

const ITEMS: { id: AdminTab; label: string; short: string; desc: string; Icon: React.ElementType; tone: string }[] = [
  { id: 'overview', label: 'Xem thống kê hệ thống', short: 'Thống kê', desc: 'Tổng quan, biểu đồ, xuất báo cáo', Icon: BarChart3, tone: 'from-orange-400 to-orange-600' },
  { id: 'dishes', label: 'Quản lý món ăn', short: 'Món ăn', desc: 'Thêm, sửa, ẩn món', Icon: UtensilsCrossed, tone: 'from-amber-400 to-orange-500' },
  { id: 'recipes', label: 'Quản lý công thức', short: 'Công thức', desc: 'Nguyên liệu và các bước nấu', Icon: BookOpen, tone: 'from-rose-400 to-red-500' },
  { id: 'users', label: 'Quản lý người dùng', short: 'Người dùng', desc: 'Tài khoản, khóa / mở khóa', Icon: Users, tone: 'from-sky-400 to-blue-600' },
  { id: 'chatbot', label: 'Giám sát Chatbot AI', short: 'Chatbot AI', desc: 'Hội thoại, phản hồi, cảnh báo', Icon: Bot, tone: 'from-emerald-400 to-emerald-600' },
  { id: 'audit', label: 'Nhật ký thao tác', short: 'Nhật ký', desc: 'Lịch sử thao tác quản trị', Icon: FileText, tone: 'from-violet-400 to-indigo-600' },
];

interface AdminMobileNavProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  onBackToUserMode: () => void;
}

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({ active, onChange, onBackToUserMode }) => {
  const [open, setOpen] = useState(false);
  // Giữ bảng menu trong DOM thêm một chút khi đóng để chạy hiệu ứng gập lại
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 380);
    return () => window.clearTimeout(t);
  }, [open]);

  // Mở menu thì khóa cuộn trang, Esc để đóng
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = ITEMS.find((i) => i.id === active) ?? ITEMS[0];
  const CurrentIcon = current.Icon;

  const pick = (id: AdminTab) => {
    setOpen(false);
    if (id !== active) {
      onChange(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return createPortal(
    <div className="lg:hidden" data-fx-off>
      {/* ── Lớp phủ + bảng menu ── */}
      {mounted && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu quản trị">
          <div
            className={`absolute inset-0 bg-slate-900/45 backdrop-blur-[3px] ${open ? 'adm-fade-in' : 'adm-fade-out'}`}
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 [perspective:1200px] px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))]">
            <div className={`adm-sheet relative rounded-[28px] p-4 ${open ? 'adm-sheet-in' : 'adm-sheet-out'}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
                    Quản lý điều hành
                  </div>
                  <div className="text-[17px] font-black text-slate-900 leading-tight">Chọn khu vực làm việc</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Đóng menu"
                  className="adm-key size-10 rounded-2xl flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {ITEMS.map((item, idx) => {
                  const on = item.id === active;
                  return (
                    <button
                      key={item.id}
                      onClick={() => pick(item.id)}
                      aria-current={on ? 'page' : undefined}
                      style={{ animationDelay: `${open ? 90 + idx * 55 : (ITEMS.length - idx) * 25}ms` }}
                      className={`adm-tile ${open ? 'adm-tile-in' : 'adm-tile-out'} ${
                        on ? 'adm-tile-on' : ''
                      } relative text-left rounded-[20px] p-3 cursor-pointer select-none [-webkit-tap-highlight-color:transparent]`}
                    >
                      <span
                        className={`adm-icon relative flex items-center justify-center size-10 rounded-[14px] text-white bg-gradient-to-br ${item.tone}`}
                      >
                        <item.Icon className="size-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" strokeWidth={2.2} />
                        {item.id === 'chatbot' && (
                          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                        )}
                      </span>
                      <span className={`block mt-2 text-[14px] font-extrabold leading-tight ${on ? 'text-white' : 'text-slate-800'}`}>
                        {item.short}
                      </span>
                      <span className={`block mt-0.5 text-[11.5px] leading-snug ${on ? 'text-orange-50/90' : 'text-slate-400'}`}>
                        {item.desc}
                      </span>
                      {on && (
                        <span className="absolute top-2.5 right-2.5 text-[10px] font-black uppercase tracking-wider bg-white/25 text-white px-1.5 py-0.5 rounded-md">
                          Đang mở
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  onBackToUserMode();
                }}
                style={{ animationDelay: `${open ? 90 + ITEMS.length * 55 : 0}ms` }}
                className={`adm-key ${open ? 'adm-tile-in' : 'adm-tile-out'} mt-3 w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[14px] font-bold text-slate-700 cursor-pointer`}
              >
                <span>Về trang người dùng</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dock nổi dưới đáy ── */}
      <div className="fixed inset-x-0 bottom-0 z-[61] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="adm-dock pointer-events-auto flex items-center gap-2 p-2 rounded-[26px]">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-1 min-w-0 flex items-center gap-3 pl-1.5 pr-2 py-1 rounded-[20px] text-left cursor-pointer select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.98] transition-transform"
            aria-label={`Đang ở: ${current.label}. Mở menu quản trị`}
          >
            <span className={`adm-icon relative flex items-center justify-center size-10 shrink-0 rounded-[14px] text-white bg-gradient-to-br ${current.tone}`}>
              {/* key đổi theo mục để icon lật 3D mỗi lần chuyển */}
              <span key={current.id} className="tabbar-flip">
                <CurrentIcon className="size-5" strokeWidth={2.2} />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[10.5px] font-extrabold tracking-[0.12em] uppercase text-slate-400">Admin Studio</span>
              <span key={current.id} className="adm-label-in block text-[15px] font-black text-slate-900 truncate">
                {current.label}
              </span>
            </span>
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
            aria-expanded={open}
            className="adm-fab-btn shrink-0 cursor-pointer select-none [-webkit-tap-highlight-color:transparent]"
          >
            <span className={`adm-fab relative flex items-center justify-center gap-1.5 h-12 px-4 rounded-[18px] text-white font-extrabold text-[14px] ${open ? 'adm-fab-open' : ''}`}>
              <span className="absolute inset-0 rounded-[18px] overflow-hidden pointer-events-none">
                <span className="tabbar-sheen absolute -inset-y-2 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
              </span>
              <span className="adm-fab-icon relative">
                {open ? <ChevronUp className="size-5 rotate-180" strokeWidth={2.6} /> : <LayoutGrid className="size-5" strokeWidth={2.4} />}
              </span>
              <span className="relative">{open ? 'Đóng' : 'Menu'}</span>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdminMobileNav;
