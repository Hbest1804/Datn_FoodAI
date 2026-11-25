import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  ShieldCheck, 
  ChevronDown, 
  LogOut, 
  LogIn, 
  UserPlus,
  Flame,
  User,
  ChefHat,
  CalendarDays,
  House,
  Clock,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { UserProfile, UserRole, GuestQuota, Recipe } from '../types';
import { apiService } from '../api';
import { GUEST_QUOTA_EVENT } from '../utils/guestQuota';
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
  onSelectDish?: (dish: Recipe) => void;
  onLogout?: () => void;
}

const SUGGEST_LIMIT = 6;
const SUGGEST_DELAY_MS = 250;

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
  onSelectDish,
  onLogout,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [suggestTotal, setSuggestTotal] = useState(0);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [guestQuota, setGuestQuota] = useState<GuestQuota | null>(null);

  // Hạn mức khách lấy từ backend (GET /chat/guest/quota), cập nhật khi trang chat / widget gửi câu hỏi
  useEffect(() => {
    if (currentUser.role !== 'guest') { setGuestQuota(null); return; }
    let cancelled = false;
    apiService.chat.getGuestQuota()
      .then(q => { if (!cancelled) setGuestQuota(q); })
      .catch(() => {});
    const onQuota = (e: Event) => setGuestQuota((e as CustomEvent<GuestQuota>).detail);
    window.addEventListener(GUEST_QUOTA_EVENT, onQuota);
    return () => { cancelled = true; window.removeEventListener(GUEST_QUOTA_EVENT, onQuota); };
  }, [currentUser.role]);

  // Gợi ý món ăn khi gõ vào ô tìm kiếm: chờ người dùng ngừng gõ rồi mới gọi GET /dishes?q=
  useEffect(() => {
    const q = searchInput.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestTotal(0);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = window.setTimeout(() => {
      apiService.dishes.getDishes({ q, limit: SUGGEST_LIMIT, sort: 'relevance' })
        .then(res => {
          if (cancelled) return;
          setSuggestions(res.dishes);
          setSuggestTotal(res.total);
          setActiveIndex(-1);
        })
        .finally(() => { if (!cancelled) setSuggestLoading(false); });
    }, SUGGEST_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [searchInput]);

  // Bấm ra ngoài ô tìm kiếm thì đóng danh sách gợi ý
  useEffect(() => {
    if (!showSuggest) return;
    const onPointerDown = (e: PointerEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showSuggest]);

  // Phím tắt Ctrl/⌘ + K để nhảy vào ô tìm kiếm
  useEffect(() => {
    if (isAdminMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdminMode]);

  const closeSuggest = () => {
    setShowSuggest(false);
    setActiveIndex(-1);
  };

  const selectDish = (dish: Recipe) => {
    apiService.dishes.trackInteraction('click', String(dish.id), { source: 'header_search', query: searchInput.trim() });
    closeSuggest();
    setSearchInput('');
    searchInputRef.current?.blur();
    onSelectDish?.(dish);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (showSuggest && activeIndex >= 0 && suggestions[activeIndex]) {
      selectDish(suggestions[activeIndex]);
      return;
    }
    if (searchInput.trim()) {
      closeSuggest();
      searchInputRef.current?.blur();
      onSearchSubmit(searchInput.trim());
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSuggest();
      return;
    }
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggest(true);
      setActiveIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowSuggest(true);
      setActiveIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    }
  };

  const trimmedQuery = searchInput.trim();
  const suggestOpen = showSuggest && trimmedQuery.length > 0;

  return (
    <>
    <header className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top micro banner for guest users */}
      {currentUser.role === 'guest' && !isAdminMode && (
        <div className="bg-orange-50 text-orange-900 px-4 py-1.5 text-[11px] sm:text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto min-w-0">
            <span className="hidden sm:inline bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[10px] shrink-0">
              Chế Độ Khách
            </span>
            <span className="hidden sm:inline">
              {guestQuota
                ? `Bạn đang dùng thử miễn phí (Còn ${guestQuota.remaining}/${guestQuota.limit} lượt hỏi AI trong 24 giờ).`
                : 'Bạn đang dùng thử miễn phí với số lượt hỏi AI giới hạn trong 24 giờ.'}
            </span>
            <span className="sm:hidden truncate">
              {guestQuota
                ? `Dùng thử: còn ${guestQuota.remaining}/${guestQuota.limit} lượt hỏi AI hôm nay.`
                : 'Bạn đang dùng thử miễn phí.'}
            </span>
            <button
              onClick={onOpenRegisterModal}
              className="underline font-bold text-orange-600 hover:text-orange-700 transition-colors ml-1 cursor-pointer shrink-0"
            >
              <span className="hidden sm:inline">Đăng ký ngay để mở khóa trọn đời & lưu thực đơn!</span>
              <span className="sm:hidden">Đăng ký</span>
            </button>
          </div>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex items-center justify-between h-16 sm:h-[72px] gap-2 sm:gap-4">
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
                  <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink group-hover:text-orange-600 transition-colors">
                    ChefAI
                  </span>
                  {isAdminMode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-orange-400 uppercase tracking-wider">
                      Studio
                    </span>
                  )}
                </div>
                <p className="hidden sm:block text-xs font-semibold text-slate-500 mt-0.5">
                  {isAdminMode ? 'CỔNG QUẢN TRỊ HỆ THỐNG' : 'Trợ lý ẩm thực & Dinh dưỡng'}
                </p>
              </div>
            </button>
          </div>

          {/* Center: Search input or Admin navigation */}
          {!isAdminMode ? (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <form onSubmit={handleSearch} className="w-full relative">
                <div ref={searchBoxRef} className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchInput}
                      onChange={(e) => { setSearchInput(e.target.value); setShowSuggest(true); }}
                      onFocus={() => setShowSuggest(true)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Tìm nguyên liệu, tên món, công thức nấu..."
                      role="combobox"
                      aria-expanded={suggestOpen}
                      aria-controls="header-search-suggest"
                      aria-autocomplete="list"
                      aria-activedescendant={activeIndex >= 0 ? `header-suggest-${activeIndex}` : undefined}
                      className="w-full pl-10 pr-16 py-2.5 text-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:ring-2 focus:ring-orange-500/30 rounded-xl transition-all outline-none text-ink placeholder-slate-400"
                    />
                    <span className="absolute right-3 text-[11px] font-mono bg-line text-slate-500 px-1.5 py-0.5 rounded pointer-events-none">
                      ⌘K
                    </span>
                  </div>

                  {/* Danh sách món ăn gợi ý sổ xuống khi gõ */}
                  {suggestOpen && (
                    <div
                      id="header-search-suggest"
                      role="listbox"
                      className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-line overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      {suggestLoading && suggestions.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                          Đang tìm món ăn...
                        </div>
                      ) : suggestions.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-slate-500">
                          Không tìm thấy món nào khớp với “<span className="font-semibold text-ink">{trimmedQuery}</span>”.
                        </div>
                      ) : (
                        <ul className={`py-1.5 max-h-[60vh] overflow-y-auto transition-opacity ${suggestLoading ? 'opacity-60' : ''}`}>
                          {suggestions.map((dish, idx) => (
                            <li key={dish.id} id={`header-suggest-${idx}`} role="option" aria-selected={idx === activeIndex}>
                              <button
                                type="button"
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => selectDish(dish)}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors ${
                                  idx === activeIndex ? 'bg-orange-50' : 'hover:bg-orange-50'
                                }`}
                              >
                                <img
                                  src={dish.image}
                                  alt=""
                                  loading="lazy"
                                  className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-semibold truncate ${idx === activeIndex ? 'text-orange-600' : 'text-ink'}`}>
                                    {dish.title}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                                    {dish.category && <span className="truncate">{dish.category}</span>}
                                    {dish.category && dish.cookingTime ? <span className="text-slate-300">•</span> : null}
                                    {dish.cookingTime ? (
                                      <span className="inline-flex items-center gap-1 shrink-0">
                                        <Clock className="w-3 h-3" />
                                        {dish.cookingTime} phút
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Xem toàn bộ kết quả ở trang Tìm kiếm & Lọc */}
                      <button
                        type="submit"
                        onMouseEnter={() => setActiveIndex(-1)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold text-orange-600 bg-surface-2 hover:bg-orange-50 border-t border-line cursor-pointer"
                      >
                        <span className="truncate">
                          {suggestTotal > suggestions.length
                            ? `Xem tất cả ${suggestTotal} kết quả cho “${trimmedQuery}”`
                            : `Tìm “${trimmedQuery}” trong trang Tìm kiếm & Lọc`}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  )}
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
            <nav className="hidden lg:flex items-center gap-1.5 [perspective:600px]">
              {[
                { tab: 'discovery', label: 'Khám phá' },
                { tab: 'search', label: 'Tìm kiếm & Lọc' },
                { tab: 'chat', label: 'Trò chuyện AI' },
                ...(currentUser.isLoggedIn ? [{ tab: 'mealPlan', label: 'Thực đơn tuần' }] : []),
              ].map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`nav3d px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer ${
                    currentTab === tab
                      ? 'nav3d-on text-orange-600 bg-orange-50 font-bold'
                      : 'text-slate-600 hover:text-ink hover:bg-surface-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : null}

          {/* Right Action Elements */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!currentUser.isLoggedIn ? (
              /* When not logged in: ONLY show Login & Register buttons */
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 whitespace-nowrap">
                <button
                  onClick={onOpenLoginModal}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={onOpenRegisterModal}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer whitespace-nowrap"
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
                        : 'bg-surface-2 hover:bg-orange-50 text-slate-700 border-line'
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
                    className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all cursor-pointer shrink-0 whitespace-nowrap h-10 select-none"
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
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-line py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-line">
                        <p className="text-xs text-slate-400 font-medium">Tài khoản</p>
                        <p className="text-sm font-bold text-slate-900">{currentUser.name}</p>
                        {currentUser.email && (
                          <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
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
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onTabChange('mealPlan');
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-orange-50 hover:text-orange-600 text-slate-700 flex items-center gap-2 cursor-pointer"
                        >
                          <CalendarDays className="w-4 h-4 text-orange-500" />
                          Thực đơn tuần
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

      </div>
    </header>

      {/* Thanh tab dưới đáy màn hình (điện thoại / máy tính bảng) – đặt ngoài <header> vì backdrop-blur
          của header làm position: fixed bị neo theo header thay vì màn hình */}
      {!isAdminMode && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex lg:hidden items-end px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200"
          aria-label="Điều hướng chính"
        >
          {([
            { id: 'discovery', label: 'Khám phá', Icon: House },
            { id: 'search', label: 'Tìm kiếm', Icon: Search },
            { id: 'chat', label: 'Chef AI', Icon: ChefHat, fab: true },
            { id: 'mealPlan', label: 'Thực đơn', Icon: CalendarDays },
            { id: 'account', label: 'Hồ sơ', Icon: User },
          ] as const).map((tab) => {
            const { id, label, Icon } = tab;
            const isFab = 'fab' in tab;
            // Hồ sơ gồm cả trang tài khoản lẫn hồ sơ khẩu vị; Thực đơn và Hồ sơ cần đăng nhập nên khách bấm vào thì mở trang đăng nhập
            const active = id === 'account' ? currentTab === 'account' || currentTab === 'profile' : currentTab === id;
            const needsLogin = id === 'account' || id === 'mealPlan';
            return (
              <button
                key={id}
                onClick={() => (needsLogin && !currentUser.isLoggedIn ? onOpenLoginModal() : onTabChange(id))}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`tabbar-btn flex-1 min-w-0 flex flex-col items-center gap-1 cursor-pointer select-none [-webkit-tap-highlight-color:transparent] ${
                  isFab ? '' : 'transition-transform active:scale-90'
                }`}
              >
                {isFab ? (
                  /* Nút Chef AI: khối 3D nhô lên khỏi mép thanh, bồng bềnh nghiêng nhẹ, có vệt sáng quét qua */
                  <span className="tabbar-fab-float -mt-6 mb-0.5">
                    <span className="tabbar-fab relative flex items-center justify-center size-[52px] rounded-full text-white ring-4 ring-white">
                      <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                        <span className="tabbar-sheen absolute -inset-y-2 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                      </span>
                      <span
                        key={active ? 'on' : 'off'}
                        className={`relative drop-shadow-[0_2px_2px_rgba(110,24,0,0.45)] ${active ? 'tabbar-flip' : ''}`}
                      >
                        <Icon className="size-6" strokeWidth={2.2} />
                      </span>
                    </span>
                  </span>
                ) : (
                  <span
                    className={`relative flex items-center px-4 py-1 rounded-full transition-colors duration-300 ${
                      active ? 'text-orange-600' : 'text-slate-500'
                    }`}
                  >
                    {active && <span className="tabbar-pill tabbar-pill-in absolute inset-0 rounded-full bg-orange-50" />}
                    {/* key đổi khi được chọn để chạy lại hiệu ứng lật 3D */}
                    <span key={active ? 'on' : 'off'} className={`relative ${active ? 'tabbar-flip' : ''}`}>
                      <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 2} />
                    </span>
                  </span>
                )}
                <span
                  className={`text-[11.6px] leading-[14px] font-semibold whitespace-nowrap ${
                    active ? 'text-orange-600' : 'text-slate-500'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
