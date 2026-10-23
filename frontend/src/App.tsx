import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DiscoveryView } from './components/DiscoveryView';
import { ChatbotView } from './components/ChatbotView';
import { SearchFilterView } from './components/SearchFilterView';
import { TasteProfileView } from './components/TasteProfileView';
import { UserProfileView } from './components/UserProfileView';
import { MealPlannerView } from './components/MealPlannerView';
import { AdminStudioView } from './components/AdminStudioView';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { AuthModals } from './components/AuthModals';
import { FloatingChefWidget } from './components/FloatingChefWidget';
import { UserProfile, UserRole, Recipe } from './types';
import { apiService } from './services/api';
import { DEFAULT_AVATAR } from './utils/dishUtils';
import { NotificationContainer, toast } from './components/NotificationModal';

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

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('discovery');
  const [currentUser, setCurrentUser] = useState<UserProfile>(DEFAULT_GUEST);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<Recipe | null>(null);

  // Cross-view shortcuts
  const [initialChatPrompt, setInitialChatPrompt] = useState<string>('');
  const [initialChatFridge, setInitialChatFridge] = useState<string[]>([]);
  const [initialChatSessionId, setInitialChatSessionId] = useState<string | undefined>(undefined);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');

  // Auth modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalType, setAuthModalType] = useState<'login' | 'register' | 'forgot-password'>('login');

  // Load initial live recipes & restore login session from backend
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live dishes
    const fetchInitialDishes = async () => {
      try {
        const res = await apiService.dishes.getDishes({ limit: 12 });
        if (isMounted && res.dishes && res.dishes.length > 0) {
          setRecipes(res.dishes);
        }
      } catch (err) {
        console.warn('Initial dishes fetch fallback:', err);
      }
    };

    // 2. Restore user session if token exists
    const checkUserSession = async () => {
      const token = localStorage.getItem('culina_token');
      if (!token) return;

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

          if (isAdmin && window.location.hash === '#admin') {
            setIsAdminMode(true);
            setCurrentTab('admin');
          }

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
      }
    };

    fetchInitialDishes();
    checkUserSession();

    return () => { isMounted = false; };
  }, []);

  const handleSwitchUserRole = (role: UserRole) => {
    if (role === 'guest') {
      setCurrentUser(DEFAULT_GUEST);
      setIsAdminMode(false);
      if (currentTab === 'admin') setCurrentTab('discovery');
    } else if (role === 'admin') {
      setCurrentUser(prev => ({
        ...prev,
        role: 'admin',
        roleLabel: 'Quản trị viên',
        name: prev.name === 'Khách' ? 'Quản Trị Viên' : prev.name,
      }));
      setIsAdminMode(true);
      setCurrentTab('admin');
    } else {
      setCurrentUser(prev => ({
        ...prev,
        role: 'user',
        roleLabel: 'Đầu bếp tại gia',
      }));
      setIsAdminMode(false);
    }
  };

  const handleToggleAdminMode = (admin: boolean) => {
    setIsAdminMode(admin);
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
    setInitialSearchQuery(query);
    setCurrentTab('search');
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
      setIsAdminMode(true);
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
    setIsAdminMode(false);
    setCurrentTab('discovery');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'admin') {
            setIsAdminMode(true);
          } else if (isAdminMode) {
            setIsAdminMode(false);
          }
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onSwitchUserRole={handleSwitchUserRole}
        isAdminMode={isAdminMode}
        onToggleAdminMode={handleToggleAdminMode}
        onOpenLoginModal={() => {
          setAuthModalType('login');
          setIsAuthModalOpen(true);
        }}
        onOpenRegisterModal={() => {
          setAuthModalType('register');
          setIsAuthModalOpen(true);
        }}
        onSearchSubmit={handleSearchSubmit}
        onLogout={handleLogout}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'discovery' && (
          <DiscoveryView
            currentUser={currentUser}
            recipes={recipes}
            onSelectRecipe={(r) => setSelectedRecipeForModal(r)}
            onOpenChatWithPrompt={handleOpenChatWithPrompt}
            onOpenRegisterModal={() => {
              setAuthModalType('register');
              setIsAuthModalOpen(true);
            }}
            onGoToProfile={() => setCurrentTab('profile')}
            onGoToPlanner={() => setCurrentTab('planner')}
          />
        )}

        {currentTab === 'search' && (
          <SearchFilterView
            currentUser={currentUser}
            recipes={recipes}
            onSelectRecipe={(r) => setSelectedRecipeForModal(r)}
            onOpenChatWithPrompt={handleOpenChatWithPrompt}
            initialSearchQuery={initialSearchQuery}
          />
        )}

        {currentTab === 'chat' && (
          <ChatbotView
            currentUser={currentUser}
            initialPrompt={initialChatPrompt}
            initialFridge={initialChatFridge}
            initialSessionId={initialChatSessionId}
            onOpenRecipe={(r) => setSelectedRecipeForModal(r)}
            onOpenRegisterModal={() => {
              setAuthModalType('register');
              setIsAuthModalOpen(true);
            }}
            onGoToProfile={() => setCurrentTab('profile')}
            onAddToPlanner={handleAddToPlanner}
          />
        )}

        {currentTab === 'profile' && (
          <TasteProfileView
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
          />
        )}

        {currentTab === 'account' && (
          <UserProfileView
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            onOpenRecipe={(r) => setSelectedRecipeForModal(r)}
            onGoToChat={(prompt) => {
              if (prompt) setInitialChatPrompt(prompt);
              setCurrentTab('chat');
            }}
            onGoToTasteProfile={() => setCurrentTab('profile')}
          />
        )}

        {currentTab === 'planner' && (
          <MealPlannerView
            currentUser={currentUser}
            recipes={recipes}
            onOpenRecipe={(r) => setSelectedRecipeForModal(r)}
            onOpenChatWithPrompt={handleOpenChatWithPrompt}
          />
        )}

        {currentTab === 'admin' && (
          <AdminStudioView
            onBackToUserMode={() => {
              setIsAdminMode(false);
              setCurrentTab('discovery');
              setCurrentUser(prev => ({
                ...prev,
                role: 'user',
                roleLabel: 'Đầu bếp tại gia',
              }));
            }}
            recipes={recipes}
            onOpenRecipe={(r) => setSelectedRecipeForModal(r)}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onSelectTab={(tab) => {
          setIsAdminMode(false);
          setCurrentTab(tab);
        }}
        onOpenLoginModal={() => {
          setAuthModalType('login');
          setIsAuthModalOpen(true);
        }}
        onToggleAdmin={() => {
          setIsAdminMode(true);
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
          onClose={() => setSelectedRecipeForModal(null)}
          currentUser={currentUser}
          onAddToPlanner={handleAddToPlanner}
          onOpenAuth={() => {
            setAuthModalType('login');
            setIsAuthModalOpen(true);
          }}
          onGoToPlanner={() => {
            setSelectedRecipeForModal(null);
            setCurrentTab('planner');
          }}
        />
      )}

      {/* Authentication Modals */}
      <AuthModals
        isOpen={isAuthModalOpen}
        type={authModalType}
        onClose={() => setIsAuthModalOpen(false)}
        onSwitchType={(t) => setAuthModalType(t)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Floating AI Chef Assistant Widget (Luôn hiển thị ở góc dưới phải) */}
      <FloatingChefWidget
        currentUser={currentUser}
        onOpenFullChat={(prompt, sessionId) => {
          if (prompt) setInitialChatPrompt(prompt);
          if (sessionId) setInitialChatSessionId(sessionId);
          setCurrentTab('chat');
        }}
        onOpenRecipe={(recipe) => setSelectedRecipeForModal(recipe)}
      />

      {/* Global Notification & Dialog Frame */}
      <NotificationContainer />
    </div>
  );
}
