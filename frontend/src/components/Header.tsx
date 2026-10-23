import React, { useState } from 'react';
import { 
  Search, 
  ShieldCheck, 
  ChevronDown, 
  LogOut, 
  LogIn, 
  UserPlus,
  Flame,
  User,
  ChefHat
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { ChefLogo3D } from './ChefLogo3D';
import { DEFAULT_AVATAR } from '../utils/dishUtils';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  currentUser: UserProfile;
  onSwitchUserRole: (role: UserRole) => void;
  isAdminMode: boolean;
  onToggleAdminMode: (admin: boolean) => void;
  onOpenLoginModal: () => void;
  onOpenRegisterModal: () => void;
  onSearchSubmit: (query: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  onSwitchUserRole,
  isAdminMode,
  onToggleAdminMode,
  onOpenLoginModal,
  onOpenRegisterModal,
  onSearchSubmit,
  onLogout,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchSubmit(searchInput.trim());
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top micro banner for guest users */}
      {currentUser.role === 'guest' && !isAdminMode && (
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto">
            <span className="bg-white/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px]">
              Chế Độ Khách
            </span>
            <span>
              Bạn đang dùng thử miễn phí (Còn {currentUser.dailyGuestLimitLeft ?? 5}/5 câu hỏi AI hôm nay).
            </span>
            <button
              onClick={onOpenRegisterModal}
              className="underline font-bold hover:text-orange-100 transition-colors ml-1 cursor-pointer"
            >
              Đăng ký ngay để mở khóa trọn đời & lưu thực đơn!
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => {
                if (isAdminMode) {
                  onToggleAdminMode(false);
                }
                onTabChange('discovery');
              }}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <ChefLogo3D size="md" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors">
                    ChefAI
                  </span>
                  {isAdminMode ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-orange-400 uppercase tracking-wider">
                      Studio
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 uppercase tracking-wider">
                      PRO AI
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {isAdminMode ? 'CỔNG QUẢN TRỊ HỆ THỐNG' : 'Trợ lý ẩm thực & Dinh dưỡng'}
                </p>
              </div>
            </button>
          </div>

          {/* Center: Search input or Admin navigation */}
          {!isAdminMode ? (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <form onSubmit={handleSearch} className="w-full relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm nguyên liệu, tên món, công thức nấu..."
                    className="w-full pl-10 pr-16 py-2.5 text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/80 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-full transition-all outline-none text-slate-800 placeholder-slate-400"
                  />
                  <span className="absolute right-3 text-[11px] font-mono bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
                    ⌘K
                  </span>
                </div>
              </form>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200/60 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                ChefAI Culinary Engine v2.4 Active
              </span>
            </div>
          )}

          {/* Navigation Links (User Mode) */}
          {!isAdminMode ? (
            <nav className="hidden lg:flex items-center gap-1.5">
              <button
                onClick={() => onTabChange('discovery')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  currentTab === 'discovery'
                    ? 'text-orange-600 bg-orange-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Khám phá
              </button>
              <button
                onClick={() => onTabChange('search')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  currentTab === 'search'
                    ? 'text-orange-600 bg-orange-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Tìm kiếm & Lọc
              </button>
              <button
                onClick={() => onTabChange('chat')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  currentTab === 'chat'
                    ? 'text-orange-600 bg-orange-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Trò chuyện AI
              </button>
              <button
                onClick={() => onTabChange('planner')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  currentTab === 'planner'
                    ? 'text-orange-600 bg-orange-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Thực đơn tuần
              </button>
              <button
                onClick={() => onTabChange('profile')}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'text-orange-600 bg-orange-50 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Hồ sơ khẩu vị
              </button>
              {currentUser.isLoggedIn && (
                <button
                  onClick={() => onTabChange('account')}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    currentTab === 'account'
                      ? 'text-orange-600 bg-orange-50 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  Thông tin cá nhân
                </button>
              )}
            </nav>
          ) : null}

          {/* Right Action Elements */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!currentUser.isLoggedIn ? (
              /* When not logged in: ONLY show Login & Register buttons */
              <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                <button
                  onClick={onOpenLoginModal}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-orange-600 hover:bg-orange-50/80 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={onOpenRegisterModal}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  Đăng ký
                </button>
              </div>
            ) : (
              /* When logged in: Show Admin switcher (if admin) + User Profile Dropdown */
              <>
                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => {
                      if (!isAdminMode) {
                        onToggleAdminMode(true);
                        onTabChange('admin');
                      } else {
                        onToggleAdminMode(false);
                        onTabChange('discovery');
                      }
                    }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                      isAdminMode
                        ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">
                      {isAdminMode ? 'Về trang người dùng' : 'Cổng Quản Trị'}
                    </span>
                  </button>
                )}

                {/* User Profile Dropdown */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border border-slate-200/90 hover:border-orange-300 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap h-10 select-none"
                    title={currentUser.name}
                  >
                    <img
                      src={(currentUser.avatar && !currentUser.avatar.includes('images.unsplash.com/photo-')) ? currentUser.avatar : DEFAULT_AVATAR}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-orange-500/20 bg-slate-200 shrink-0"
                    />
                    <div className="text-left hidden md:flex flex-col justify-center whitespace-nowrap shrink-0">
                      <div className="text-xs font-bold text-slate-900 leading-tight whitespace-nowrap">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium leading-tight whitespace-nowrap">
                        {currentUser.roleLabel}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">Tài khoản</p>
                        <p className="text-sm font-bold text-slate-900">{currentUser.name}</p>
                        {currentUser.email && (
                          <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                        )}
                        {currentUser.dietPreference && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                              {currentUser.dietPreference}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('account');
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-orange-50 hover:text-orange-600 text-slate-700 flex items-center gap-2 cursor-pointer"
                        >
                          <User className="w-4 h-4 text-orange-500" />
                          Thông tin cá nhân & Tài khoản
                        </button>
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('profile');
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-orange-50 hover:text-orange-600 text-slate-700 flex items-center gap-2 cursor-pointer"
                        >
                          <ChefHat className="w-4 h-4 text-orange-500" />
                          Hồ sơ khẩu vị & Dinh dưỡng
                        </button>
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              onToggleAdminMode(!isAdminMode);
                              onTabChange(isAdminMode ? 'discovery' : 'admin');
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4 text-orange-500" />
                            {isAdminMode ? 'Về trang người dùng' : 'Cổng Quản Trị'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            if (onLogout) {
                              onLogout();
                            } else {
                              onSwitchUserRole('guest');
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        {!isAdminMode && (
          <div className="flex lg:hidden overflow-x-auto py-2 gap-2 border-t border-slate-100 no-scrollbar">
            <button
              onClick={() => onTabChange('discovery')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                currentTab === 'discovery' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Khám phá
            </button>
            <button
              onClick={() => onTabChange('search')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                currentTab === 'search' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Tìm kiếm & Lọc
            </button>
            <button
              onClick={() => onTabChange('chat')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                currentTab === 'chat' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Trò chuyện AI
            </button>
            <button
              onClick={() => onTabChange('planner')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                currentTab === 'planner' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Thực đơn
            </button>
            <button
              onClick={() => onTabChange('profile')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 ${
                currentTab === 'profile' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Hồ sơ khẩu vị
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
