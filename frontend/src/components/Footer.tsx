 import React from 'react';
import { UtensilsCrossed, Sparkles, Shield, HeartHandshake } from 'lucide-react';
import { ChefLogo3D } from './ChefLogo3D';

interface FooterProps {
  onSelectTab: (tab: string) => void;
  onOpenLoginModal: () => void;
  onToggleAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, onOpenLoginModal, onToggleAdmin }) => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-20 pt-16 pb-12 text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-100">
          {/* Col 1: Brand */}
          <div className="md:col-span-2 space-y-4 pr-6">
            <div className="flex items-center gap-3">
              <ChefLogo3D size="md" />
              <span className="text-2xl font-black text-slate-900 tracking-tight">ChefAI</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md">
              Hệ thống trợ lý ẩm thực thông minh tích hợp trí tuệ nhân tạo Gemini, tư vấn công thức nấu nướng, 
              đề xuất thực đơn cá nhân hóa theo khẩu vị, quản lý dinh dưỡng và kiểm soát an toàn dị ứng thực phẩm.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bảo chứng y tế dinh dưỡng & thuật toán phòng ngừa dị ứng thực phẩm 24/7</span>
            </div>
          </div>

          {/* Col 2: Features */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              TÍNH NĂNG NỔI BẬT
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => onSelectTab('search')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Tìm kiếm & Lọc món ăn đa chiều
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('discovery')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Gợi ý món theo hồ sơ khẩu vị
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('chat')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Tìm món từ tủ lạnh (Chống lãng phí)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('profile')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Cài đặt dị ứng & Calo mục tiêu
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('account')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Thông tin cá nhân & Món yêu thích
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('planner')}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer"
                >
                  Lên thực đơn tuần & Đi chợ thông minh
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Social Media & Channels */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              KẾT NỐI VỚI CHÚNG TÔI
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Theo dõi kênh để nhận mẹo nấu ăn và thực đơn mới mỗi ngày:
            </p>
            <div className="flex flex-wrap gap-2.5 mb-4">
              {/* TikTok */}
              <a
                href="https://www.tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                title="TikTok ChefAI"
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-black text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm group"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.9a8.18 8.18 0 0 0 4.77 1.52V6.97a4.85 4.85 0 0 1-1-.28z"/>
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube ChefAI"
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm shadow-red-500/20"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook ChefAI"
                className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm shadow-blue-500/20"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram ChefAI"
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm shadow-rose-500/20"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-500">
              <li>
                <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 transition-colors flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  TikTok: <span className="font-medium text-slate-700">@chefai.official</span>
                </a>
              </li>
              <li>
                <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 transition-colors flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  YouTube: <span className="font-medium text-slate-700">ChefAI Việt Nam</span>
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 transition-colors flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Cộng đồng: <span className="font-medium text-slate-700">Hội Yêu Bếp & Dinh Dưỡng ChefAI</span>
                </a>
              </li>
              <li className="pt-2">
                <button
                  onClick={onToggleAdmin}
                  className="hover:text-orange-600 transition-colors text-left cursor-pointer font-semibold text-orange-600 flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Quản trị viên (ChefAI Studio)
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div>
            © 2026 ChefAI. Bảo lưu mọi quyền. • Tích hợp AI Gemini 3.8 Flash
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-600 cursor-pointer">An toàn thực phẩm</span>
            <span className="hover:text-slate-600 cursor-pointer">Bảo vệ dữ liệu</span>
            <span className="hover:text-slate-600 cursor-pointer">Điều khoản dịch vụ</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
