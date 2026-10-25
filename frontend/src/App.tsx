import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DiscoveryView } from './components/DiscoveryView';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { AuthModals } from './components/AuthModals';
import { FloatingChefWidget } from './components/FloatingChefWidget';
import { UserProfile, UserRole, Recipe } from './types';
import { apiService } from './services/api';
import { DEFAULT_AVATAR } from './utils/dishUtils';
import { NotificationContainer, toast } from './components/NotificationModal';

// Các trang ngoài trang chủ chỉ tải khi người dùng mở tới, giúp trang chủ hiện nhanh hơn
const ChatbotView = lazy(() => import('./components/ChatbotView').then((m) => ({ default: m.ChatbotView })));
const SearchFilterView = lazy(() => import('./components/SearchFilterView').then((m) => ({ default: m.SearchFilterView })));
const TasteProfileView = lazy(() => import('./components/TasteProfileView').then((m) => ({ default: m.TasteProfileView })));
const UserProfileView = lazy(() => import('./components/UserProfileView').then((m) => ({ default: m.UserProfileView })));
const MealPlannerView = lazy(() => import('./components/MealPlannerView').then((m) => ({ default: m.MealPlannerView })));
const AdminStudioView = lazy(() => import('./components/AdminStudioView').then((m) => ({ default: m.AdminStudioView })));

const DEFAULT_GUEST: UserProfile = {
  id: '',
  name: 'Khách',
  email: '',
  avatar: DEFAULT_AVATAR,
  role: 'guest',
  roleLabel: 'Khách vãng lai',
  isLoggedIn: false,
  isPro: false,
  joinedDate: 'Hôm nay',
  lastActive: 'Vừa xong',
  dietPreference: 'Bình thường',
  targetCalories: 2000,
  targetProtein: 90,
  targetCarbs: 220,
  targetFat: 60,
  todayConsumedCalories: 0,
  todayConsumedProtein: 0,
  todayConsumedWaterLiters: 0,
  todayTargetWaterLiters: 2.0,
  allergiesHardLock: [],
  intolerances: {
    lactose: false,
    gluten: false,
    autoSubstituteLactose: false,
  },
  sensory: {
    spiciness: 2,
    saltiness: 2,
    sweetness: 2,
    sourness: 2,
    oiliness: 2,
    herbAroma: 2,
  },
  favoriteCuisines: [],
  favoriteIngredients: [],
  kitchenDevices: [],
  availableCookingTime: '30 phút',
  chatQueriesCount: 0,
  isTasteSyncedWithAi: false,
  tasteAccuracy: 0,
};

// Ánh xạ giữa tên tab (Header/Footer dùng) và đường dẫn URL
const TAB_PATHS: Record<string, string> = {
  discovery: '/',
  search: '/search',
  chat: '/chat',
  planner: '/planner',
  profile: '/taste-profile',
  account: '/account',
  admin: '/admin',
};

const pathToTab = (pathname: string): string => {
  const match = Object.entries(TAB_PATHS).find(([, path]) => path !== '/' && pathname.startsWith(path));
  return match ? match[0] : 'discovery';
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = pathToTab(location.pathname);
  const isAdminMode = currentTab === 'admin';
  const setCurrentTab = (tab: string) => navigate(TAB_PATHS[tab] ?? '/');

  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_GUEST);
  // Đã kiểm tra xong phiên đăng nhập hay chưa (tránh đá Admin ra khỏi /admin khi F5)
  const [sessionChecked, setSessionChecked] = useState<boolean>(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<Recipe | null>(null);
  const [resetTokenFromLink, setResetTokenFromLink] = useState<string>('');

  // Cross-view shortcuts
  const [initialChatPrompt, setInitialChatPrompt] = useState<string>('');
  const [initialChatFridge, setInitialChatFridge] = useState<string[]>([]);
  const [initialChatSessionId, setInitialChatSessionId] = useState<string | undefined>(undefined);
  const searchQueryParam = currentTab === 'search' ? (searchParams.get('q') ?? '') : '';
  const dishParam = searchParams.get('dish');

  // Auth modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalType, setAuthModalType] = useState<'login' | 'register' | 'forgot-password'>('login');

  // Load initial live recipes & restore login session from backend
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live dishes
    // Máy chủ đang khởi động lại hoặc CSDL phản hồi chậm thì lượt đầu trả rỗng: thử lại sau 2s, 4s, 8s, 16s
    const fetchInitialDishes = async (attempt = 0) => {
      try {
        // Món vừa cập nhật / vừa công khai lên đầu trang Khám phá
        const res = await apiService.dishes.getDishes({ limit: 12, sort: 'updated' });
        if (isMounted && res.dishes && res.dishes.length > 0) {
          setRecipes(res.dishes);
          return;
        }
      } catch (err) {
        console.warn('Initial dishes fetch fallback:', err);
      }
      if (isMounted && attempt < 4) {
        setTimeout(() => fetchInitialDishes(attempt + 1), 2000 * 2 ** attempt);
      }
    };

    // 2. Restore user session if token exists
    const checkUserSession = async () => {
      const token = localStorage.getItem('culina_token');
      if (!token) {
        setSessionChecked(true);
        return;
      }

      try {
        const userRes = await apiService.auth.getMe();
        const u = userRes?.user || (userRes as any)?.data;
        if (isMounted && u) {
          const isAdmin = u.role === 'admin';
          
          setCurrentUser(prev => ({
            ...prev,
            id: u.id,
            name: u.display_name || u.name || (u.email ? u.email.split('@')[0] : 'Thành viên'),
            email: u.email || '',
            avatar: (u.avatar_url && !u.avatar_url.includes('images.unsplash.com/photo-')) 
              ? u.avatar_url 
              : ((prev.avatar && !prev.avatar.includes('images.unsplash.com/photo-')) ? prev.avatar : DEFAULT_AVATAR),
            role: isAdmin ? 'admin' : 'user',
            roleLabel: isAdmin ? 'Quản trị viên' : 'Đầu bếp tại gia',
            isLoggedIn: true,
            isPro: true,
          }));

          // Try to fetch user's taste profile
          try {
            const profileRes = await apiService.me.getTasteProfile();
            if (isMounted && profileRes) {
              const p = profileRes;
              setCurrentUser(prev => ({
                ...prev,
                spicinessLevel: p.taste_prefs?.spicy_level ?? prev.spicinessLevel,
                saltinessLevel: p.taste_prefs?.salty_level ?? prev.saltinessLevel,
                sweetnessLevel: p.taste_prefs?.sweet_level ?? prev.sweetnessLevel,
                sournessLevel: p.taste_prefs?.sour_level ?? prev.sournessLevel,
                targetCalories: p.calorie_goal ?? prev.targetCalories,
                householdSize: p.household_size ?? prev.householdSize,
                budgetPerMeal: p.budget_max ?? prev.budgetPerMeal,
                dietPreference: p.diet_types?.[0]?.name || prev.dietPreference,
                allergies: p.allergen_groups?.map((a: any) => a.name) || prev.allergies,
              }));
            }
          } catch {
            // Profile may be empty initially, which is fine
          }
        }
      } catch (err) {
        console.warn('Session expired or invalid:', err);
        localStorage.removeItem('culina_token');
        localStorage.removeItem('culina_user');
      } finally {
        if (isMounted) setSessionChecked(true);
      }
    };

    // Ghi nhận một lượt truy cập cho mỗi phiên trình duyệt (dùng cho thống kê lượt truy cập của Admin)
    try {
      if (!sessionStorage.getItem('culina_visit_logged')) {
        sessionStorage.setItem('culina_visit_logged', '1');
        apiService.dishes.trackInteraction('page_view', undefined, { path: window.location.pathname });
      }
    } catch {
      // sessionStorage không khả dụng: bỏ qua
    }

    fetchInitialDishes();
    checkUserSession();

    return () => { isMounted = false; };
  }, []);

  // Chi tiết món mở dưới dạng ?dish=<id> trên trang hiện tại: F5 hoặc gửi link vẫn mở lại đúng món,
  // nút Back của trình duyệt sẽ đóng cửa sổ chi tiết
  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipeForModal(recipe);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('dish', String(recipe.id));
      return next;
    });
  };

  const closeRecipe = () => {
    setSelectedRecipeForModal(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('dish');
      return next;
    });
  };

  useEffect(() => {
    if (!dishParam) {
      setSelectedRecipeForModal(null);
      return;
    }
    if (selectedRecipeForModal && String(selectedRecipeForModal.id) === dishParam) return;
    let cancelled = false;
    apiService.dishes.getDetail(dishParam)
      .then(recipe => {
        if (!cancelled) setSelectedRecipeForModal(recipe);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Không tìm thấy món ăn hoặc món đã bị ẩn.');
        closeRecipe();
      });
    return () => { cancelled = true; };
  }, [dishParam]);

  // Trang Quản trị: chờ khôi phục phiên đăng nhập xong mới kiểm tra quyền
  useEffect(() => {
    if (!isAdminMode || !sessionChecked || currentUser.role === 'admin') return;
    toast.warning('Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập trang này.');
    navigate('/', { replace: true });
    if (!currentUser.isLoggedIn) {
      setAuthModalType('login');
      setIsAuthModalOpen(true);
    }
  }, [isAdminMode, sessionChecked, currentUser.role, currentUser.isLoggedIn]);

  // Liên kết đặt lại mật khẩu trong email: /reset-password?token=...
  useEffect(() => {
    if (location.pathname !== '/reset-password') return;
    setResetTokenFromLink(searchParams.get('token') ?? '');
    setAuthModalType('forgot-password');
    setIsAuthModalOpen(true);
    navigate('/', { replace: true });
  }, [location.pathname]);

  const handleSwitchUserRole = (role: UserRole) => {
    if (role === 'guest') {
      setCurrentUser(DEFAULT_GUEST);
      if (isAdminMode) setCurrentTab('discovery');
    } else if (role === 'admin') {
      setCurrentUser(prev => ({
        ...prev,
        role: 'admin',
        roleLabel: 'Quản trị viên',
        name: prev.name === 'Khách' ? 'Quản Trị Viên' : prev.name,
      }));
      setCurrentTab('admin');
    } else {
      setCurrentUser(prev => ({
        ...prev,
        role: 'user',
        roleLabel: 'Đầu bếp tại gia',
      }));
      if (isAdminMode) setCurrentTab('discovery');
    }
  };

  const handleToggleAdminMode = (admin: boolean) => {
    if (admin) {
      setCurrentUser(prev => ({
        ...prev,
        role: 'admin',
        roleLabel: 'Quản trị viên',
      }));
      setCurrentTab('admin');
    } else {
      setCurrentTab('discovery');
    }
  };

  const handleOpenChatWithPrompt = (prompt: string, fridgeContext?: string[]) => {
    setInitialChatPrompt(prompt);
    if (fridgeContext && fridgeContext.length > 0) {
      setInitialChatFridge(fridgeContext);
    } else {
      setInitialChatFridge([]);
    }
    setCurrentTab('chat');
  };

  const handleSearchSubmit = (query: string) => {
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const handleAddToPlanner = (recipe: Recipe) => {
    toast.success(`Đã thêm món "${recipe.title}" vào Thực Đơn Tuần của bạn!`, 'Kế hoạch bữa ăn');
  };

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setCurrentUser(prev => ({ ...prev, ...updated }));
  };

  const handleLoginSuccess = (userPartial: Partial<UserProfile>) => {
    const isAdmin = userPartial.role === 'admin';
    setCurrentUser(prev => ({
      ...prev,
      ...userPartial,
      role: isAdmin ? 'admin' : 'user',
      roleLabel: isAdmin ? 'Quản trị viên' : 'Đầu bếp tại gia',
      isLoggedIn: true,
      isPro: true,
    }));
    if (isAdmin) {
      setCurrentTab('admin');
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.auth.logout();
    } catch {}
    localStorage.removeItem('culina_token');
    localStorage.removeItem('culina_user');
    setCurrentUser(DEFAULT_GUEST);
    setCurrentTab('discovery');
  };

  const openRegisterModal = () => {
    setAuthModalType('register');
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentUser={currentUser}
        onSwitchUserRole={handleSwitchUserRole}
        isAdminMode={isAdminMode}
        onToggleAdminMode={handleToggleAdminMode}
        onOpenLoginModal={() => {
          setAuthModalType('login');
          setIsAuthModalOpen(true);
        }}
        onOpenRegisterModal={openRegisterModal}
        onSearchSubmit={handleSearchSubmit}
        onLogout={handleLogout}
      />

      {/* Main Content View Container */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${isAdminMode ? 'max-w-[1520px]' : 'max-w-7xl'}`}>
        <Suspense
          fallback={
            <div className="py-24 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          }
        >
        <Routes>
          <Route
            path="/"
            element={
              <DiscoveryView
                currentUser={currentUser}
                recipes={recipes}
                onSelectRecipe={openRecipe}
                onOpenChatWithPrompt={handleOpenChatWithPrompt}
                onOpenRegisterModal={openRegisterModal}
                onGoToProfile={() => setCurrentTab('profile')}
                onGoToPlanner={() => setCurrentTab('planner')}
              />
            }
          />

          <Route
            path="/search"
            element={
              <SearchFilterView
                // Đổi từ khóa trên URL (tìm từ Header) → khởi tạo lại trang tìm kiếm với từ khóa mới
                key={searchQueryParam}
                currentUser={currentUser}
                recipes={recipes}
                onSelectRecipe={openRecipe}
                onOpenChatWithPrompt={handleOpenChatWithPrompt}
                initialSearchQuery={searchQueryParam}
              />
            }
          />

          <Route
            path="/chat"
            element={
              <ChatbotView
                currentUser={currentUser}
                recipes={recipes}
                initialPrompt={initialChatPrompt}
                initialFridge={initialChatFridge}
                initialSessionId={initialChatSessionId}
                onOpenRecipe={openRecipe}
                onOpenRegisterModal={openRegisterModal}
                onGoToProfile={() => setCurrentTab('profile')}
                onAddToPlanner={handleAddToPlanner}
              />
            }
          />

          <Route
            path="/taste-profile"
            element={
              <TasteProfileView
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
              />
            }
          />

          <Route
            path="/account"
            element={
              <UserProfileView
                currentUser={currentUser}
                onUpdateUser={handleUpdateUser}
                onOpenRecipe={openRecipe}
                onGoToChat={(prompt) => {
                  if (prompt) setInitialChatPrompt(prompt);
                  setCurrentTab('chat');
                }}
                onGoToTasteProfile={() => setCurrentTab('profile')}
              />
            }
          />

          <Route
            path="/planner"
            element={
              <MealPlannerView
                currentUser={currentUser}
                recipes={recipes}
                onOpenRecipe={openRecipe}
                onOpenChatWithPrompt={handleOpenChatWithPrompt}
              />
            }
          />

          <Route
            path="/admin"
            element={
              currentUser.role === 'admin' ? (
                <AdminStudioView
                  onBackToUserMode={() => {
                    setCurrentTab('discovery');
                    setCurrentUser(prev => ({
                      ...prev,
                      role: 'user',
                      roleLabel: 'Đầu bếp tại gia',
                    }));
                  }}
                  recipes={recipes}
                  onOpenRecipe={openRecipe}
                />
              ) : (
                <div className="py-24 flex flex-col items-center gap-3 text-sm text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  Đang kiểm tra quyền truy cập...
                </div>
              )
            }
          />

          {/* /reset-password được xử lý bằng effect phía trên rồi chuyển về trang chủ */}
          <Route path="/reset-password" element={null} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      <Footer
        onSelectTab={setCurrentTab}
        onOpenLoginModal={() => {
          setAuthModalType('login');
          setIsAuthModalOpen(true);
        }}
        onToggleAdmin={() => {
          setCurrentUser(prev => ({
            ...prev,
            role: 'admin',
            roleLabel: 'Quản trị viên',
          }));
          setCurrentTab('admin');
        }}
      />

      {/* Recipe Detail Modal */}
      {selectedRecipeForModal && (
        <RecipeDetailModal
          recipe={selectedRecipeForModal}
          onClose={closeRecipe}
          currentUser={currentUser}
          onAddToPlanner={handleAddToPlanner}
          onOpenAuth={() => {
            setAuthModalType('login');
            setIsAuthModalOpen(true);
          }}
          onOpenChatWithPrompt={(prompt, fridgeContext) => {
            setSelectedRecipeForModal(null);
            handleOpenChatWithPrompt(prompt, fridgeContext);
          }}
        />
      )}

      {/* Authentication Modals */}
      <AuthModals
        isOpen={isAuthModalOpen}
        type={authModalType}
        onClose={() => {
          setIsAuthModalOpen(false);
          setResetTokenFromLink('');
        }}
        onSwitchType={(t) => setAuthModalType(t)}
        onLoginSuccess={handleLoginSuccess}
        initialResetToken={resetTokenFromLink}
      />

      {/* Floating AI Chef Assistant Widget (Luôn hiển thị ở góc dưới phải) */}
      <FloatingChefWidget
        currentUser={currentUser}
        onOpenFullChat={(prompt, sessionId) => {
          if (prompt) setInitialChatPrompt(prompt);
          if (sessionId) setInitialChatSessionId(sessionId);
          setCurrentTab('chat');
        }}
        onOpenRecipe={openRecipe}
      />

      {/* Global Notification & Dialog Frame */}
      <NotificationContainer />
    </div>
  );
}
