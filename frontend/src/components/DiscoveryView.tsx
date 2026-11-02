import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Clock, 
  ChevronRight, 
  Heart, 
  Bookmark, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw, 
  ChefHat, 
  CalendarDays, 
  Sliders, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  Utensils,
  Send,
  Flame,
  Star,
  X
} from 'lucide-react';
import { UserProfile, Recipe } from '../types';
import { apiService } from '../api';
import { formatMetric } from '../utils/dishUtils';

interface DiscoveryViewProps {
  currentUser: UserProfile;
  recipes: Recipe[];
  totalRecipes: number;
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenChatWithPrompt: (prompt: string) => void;
  onOpenRegisterModal: () => void;
  onGoToProfile: () => void;
  onGoToPlanner: () => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  currentUser,
  recipes: allRecipes,
  totalRecipes,
  onSelectRecipe,
  onOpenChatWithPrompt,
  onOpenRegisterModal,
  onGoToProfile,
  onGoToPlanner,
}) => {
  const isGuest = currentUser.role === 'guest';
  const [selectedFilter, setSelectedFilter] = useState('Tất cả');
  const [activeMealTab, setActiveMealTab] = useState<'lunch' | 'dinner' | 'snack' | 'tomorrow'>('lunch');
  const [goldenMealIndex, setGoldenMealIndex] = useState(0);

  // Gợi ý cá nhân hóa theo hồ sơ khẩu vị (GET /me/recommendations); lỗi hoặc rỗng thì dùng danh sách món chung
  const [personalRecipes, setPersonalRecipes] = useState<Recipe[]>([]);
  const [recsUpdatedAt, setRecsUpdatedAt] = useState<Date | null>(null);
  const profileKey = JSON.stringify([
    currentUser.id,
    currentUser.dietPreference,
    currentUser.targetCalories,
    currentUser.allergies,
    currentUser.spicinessLevel,
    currentUser.saltinessLevel,
    currentUser.sweetnessLevel,
    currentUser.sournessLevel,
  ]);

  useEffect(() => {
    if (isGuest) {
      setPersonalRecipes([]);
      return;
    }
    let cancelled = false;
    apiService.dishes.getRecommendations(20).then(list => {
      if (!cancelled) {
        setPersonalRecipes(list);
        setRecsUpdatedAt(new Date());
        setGoldenMealIndex(0);
      }
    });
    return () => { cancelled = true; };
  }, [isGuest, profileKey]);

  const recipes = !isGuest && personalRecipes.length > 0 ? personalRecipes : allRecipes;

  // Quick dietary filter tags
  const filterPills = [
    'Tất cả',
    'Bữa sáng dưới 15 phút',
    'Eat Clean giảm mỡ',
    'Món chay thanh tịnh',
    'Cơm nhà chuẩn vị',
    'Keto dễ làm',
    'Tăng cơ giàu đạm'
  ];

  const goldenMeals = recipes.filter(Boolean);
  const currentGoldenMeal = goldenMeals.length > 0 ? goldenMeals[goldenMealIndex % goldenMeals.length] : null;

  // Filter meals based on activeMealTab (for users) or selectedFilter (for guests)
  const mealsFor = (tab: 'lunch' | 'dinner' | 'snack' | 'tomorrow'): Recipe[] => {
    if (!recipes || recipes.length === 0) return [];

    if (isGuest) {
      if (selectedFilter === 'Tất cả') return recipes.slice(1, 5);
      const filtered = recipes.filter(r => {
        const text = `${r.title} ${r.description} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (selectedFilter.includes('15 phút')) return (r.cookingTime != null && r.cookingTime <= 20) || text.includes('sáng');
        if (selectedFilter.includes('Eat Clean')) return (r.macros.calories != null && r.macros.calories < 500) || text.includes('clean') || text.includes('salad');
        if (selectedFilter.includes('chay')) return text.includes('chay') || text.includes('rau') || text.includes('nấm');
        if (selectedFilter.includes('Cơm nhà')) return text.includes('cơm') || text.includes('kho') || text.includes('xào') || text.includes('canh');
        if (selectedFilter.includes('Keto')) return (r.macros.carbs != null && r.macros.carbs < 25) || text.includes('keto');
        if (selectedFilter.includes('Tăng cơ') || selectedFilter.includes('đạm')) return (r.macros.protein != null && r.macros.protein >= 25);
        return text.includes(selectedFilter.toLowerCase());
      });
      return filtered.length > 0 ? filtered.slice(0, 4) : recipes.slice(1, 5);
    }

    // For logged-in users: separate dishes per meal slot
    if (tab === 'lunch') {
      // Bữa trưa hôm nay ({lunchCount}): Món chính giàu năng lượng, no lâu
      const lunchDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.macros.calories != null && r.macros.calories >= 380) || text.includes('cơm') || text.includes('xào') || text.includes('kho') || text.includes('bò') || text.includes('gà');
      });
      return lunchDishes.length >= 2 ? lunchDishes.slice(0, 4) : recipes.slice(1, 5);
    }

    if (tab === 'dinner') {
      // Bữa tối: Thanh đạm, nhẹ bụng, ít calo/carbs hơn hoặc lấy slot khác để không trùng bữa trưa
      const dinnerDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.macros.calories != null && r.macros.calories < 480) || text.includes('canh') || text.includes('hấp') || text.includes('súp') || text.includes('salad') || text.includes('cá');
      });
      // Nếu có món phân loại theo calo/từ khóa, ưu tiên hiển thị; nếu ít quá thì lấy các món từ vị trí thứ 5 trở đi để không trùng bữa trưa
      if (dinnerDishes.length >= 4) return dinnerDishes.slice(0, 4);
      const fallback = recipes.slice(5, 9);
      return fallback.length > 0 ? fallback : dinnerDishes;
    }

    if (tab === 'snack') {
      // Snack & Năng lượng ({snackCount}): món nấu nhanh, sinh tố, tráng miệng, hoặc nhẹ bụng
      const snackDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.cookingTime != null && r.cookingTime <= 20) || (r.macros.calories != null && r.macros.calories < 320) || text.includes('snack') || text.includes('bánh') || text.includes('nước') || text.includes('tráng miệng') || text.includes('salad');
      });
      if (snackDishes.length >= 3) return snackDishes.slice(0, 4);
      const fallback = recipes.slice(9, 13);
      return fallback.length > 0 ? fallback : recipes.slice(0, 4);
    }

    return recipes.slice(1, 5);
  };
  const displayedMeals = useMemo(() => mealsFor(activeMealTab), [recipes, isGuest, selectedFilter, activeMealTab]);
  const lunchCount = isGuest ? 0 : mealsFor('lunch').length;
  const dinnerCount = isGuest ? 0 : mealsFor('dinner').length;
  const snackCount = isGuest ? 0 : mealsFor('snack').length;

  // Live in-page AI widget state
  // Thanh tiến độ = tỉ lệ calo của món so với mục tiêu calo/ngày (mặc định 2000 kcal nếu chưa đặt mục tiêu)
  const dailyCalories = currentUser.targetCalories > 0 ? currentUser.targetCalories : 2000;
  const caloPercent = (calo: number | null) => (calo == null ? 0 : Math.min(100, Math.round((calo / dailyCalories) * 100)));

  const [widgetQuery, setWidgetQuery] = useState('');
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetData, setWidgetData] = useState<{
    userPrompt: string;
    dishTitle: string;
    dishCalo: number | null;
    dishTime: number | null;
    protein: number | null;
    carbs: number | null;
  }>(() => {
    const first = recipes.length > 0 ? recipes[0] : null;
    return {
      userPrompt: 'Gợi ý món ăn dinh dưỡng phù hợp hôm nay nhé AI!',
      dishTitle: first ? first.title : 'Đang chọn món phù hợp...',
      dishCalo: first?.macros.calories ?? null,
      dishTime: first?.cookingTime ?? null,
      protein: first?.macros.protein ?? null,
      carbs: first?.macros.carbs ?? null,
    };
  });

  useEffect(() => {
    if (recipes.length > 0 && widgetData.dishTitle === 'Đang chọn món phù hợp...') {
      const first = recipes[0];
      setWidgetData(prev => ({
        ...prev,
        dishTitle: first.title,
        dishCalo: first.macros.calories,
        dishTime: first.cookingTime,
        protein: first.macros.protein,
        carbs: first.macros.carbs,
      }));
    }
  }, [recipes, widgetData.dishTitle]);

  const handleWidgetAsk = async (promptText: string) => {
    if (!promptText.trim()) return;
    setWidgetLoading(true);
    setWidgetData(prev => ({ ...prev, userPrompt: promptText }));

    try {
      const res = await apiService.chat.sendGuestMessage(promptText);
      const reply = res.reply;
      const firstDish = reply.dishes && reply.dishes.length > 0 ? reply.dishes[0] : null;

      if (firstDish) {
        const dishAny = firstDish as any;
        setWidgetData({
          userPrompt: promptText,
          dishTitle: firstDish.name,
          dishCalo: dishAny.calories ?? null,
          dishTime: firstDish.cook_time_minutes ?? null,
          protein: dishAny.protein_g ?? null,
          carbs: dishAny.carbs_g ?? null,
        });
      } else {
        // Parse from AI text
        setWidgetData({
          userPrompt: promptText,
          dishTitle: reply.content.slice(0, 48) + '...',
          dishCalo: null,
          dishTime: null,
          protein: null,
          carbs: null,
        });
      }
    } catch {
      const fallbackDish = recipes.length > 0 ? recipes[0] : null;
      if (fallbackDish) {
        setWidgetData({
          userPrompt: promptText,
          dishTitle: fallbackDish.title,
          dishCalo: fallbackDish.macros.calories,
          dishTime: fallbackDish.cookingTime,
          protein: fallbackDish.macros.protein,
          carbs: fallbackDish.macros.carbs,
        });
      }
    } finally {
      setWidgetLoading(false);
      setWidgetQuery('');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const hasTasteGoal = Boolean(currentUser.dietPreference) || currentUser.targetCalories > 0;

  // Đánh giá của người dùng trong 7 ngày gần nhất (GET /me/ratings)
  const [recentRatings, setRecentRatings] = useState<Array<{ id: number; stars: number; dishName: string }>>([]);
  useEffect(() => {
    if (isGuest) {
      setRecentRatings([]);
      return;
    }
    let cancelled = false;
    apiService.me.getMyRatings().then(list => {
      if (cancelled) return;
      const since = Date.now() - 7 * 86400000;
      setRecentRatings((list || [])
        .filter((r: any) => r?.dish && Date.parse(r.created_at) >= since)
        .map((r: any) => ({ id: r.id, stars: r.stars, dishName: r.dish.name })));
    }).catch(() => { if (!cancelled) setRecentRatings([]); });
    return () => { cancelled = true; };
  }, [isGuest, currentUser.id]);
  const likedRecent = recentRatings.filter(r => r.stars >= 4);

  // Banner AI Insight: món xem gần nhất lấy từ lịch sử xem, có thể ẩn trong phiên hiện tại
  const [lastViewed, setLastViewed] = useState<{ name: string; calories: number | null } | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(false);
  useEffect(() => {
    if (isGuest) {
      setLastViewed(null);
      return;
    }
    let cancelled = false;
    apiService.me.getViewHistory().then(list => {
      if (cancelled) return;
      const dish = list?.[0]?.dish || list?.[0];
      setLastViewed(dish?.name ? { name: dish.name, calories: dish.calories ?? null } : null);
    }).catch(() => { if (!cancelled) setLastViewed(null); });
    return () => { cancelled = true; };
  }, [isGuest, currentUser.id]);

  const mealSlot = hour < 10 ? 'bữa sáng' : hour < 14 ? 'bữa trưa' : hour < 17 ? 'bữa phụ chiều' : 'bữa tối';
  const topRecommendation = personalRecipes[0] || null;
  const allergyList = (currentUser.allergies || []).filter(Boolean);

  const handleNextGoldenMeal = () => {
    setGoldenMealIndex(prev => prev + 1);
  };

  const recipeCard = (recipe: Recipe) => (
    <div
      key={recipe.id}
      onClick={() => onSelectRecipe(recipe)}
      className="bg-white rounded-3xl p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col"
    >
      <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-surface">
        <img
          src={recipe.image}
          alt={recipe.title}
          loading="lazy" decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {isGuest ? (
          recipe.category && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-white/90 text-[11px] font-bold text-orange-600 shadow-xs">
              {recipe.category}
            </span>
          )
        ) : (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-mint text-[11px] font-bold text-emerald-800 shadow-xs">
            {recipe.matchPercentage != null ? `${recipe.matchPercentage}%` : '—'} Match
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/85 backdrop-blur-xs text-slate-600 group-hover:text-orange-600 flex items-center justify-center transition-colors">
          <Heart className="w-4 h-4" />
        </span>
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between text-[11px] font-semibold text-white">
          <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-xs flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-300" />
            {formatMetric(recipe.macros.calories, ' kcal')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-xs flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-300" />
            {formatMetric(recipe.cookingTime)} phút
          </span>
        </div>
      </div>

      <div className="px-1.5 pt-3 pb-1 flex-1 flex flex-col gap-2">
        {recipe.rating > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            <span className="font-bold text-ink">{recipe.rating.toFixed(1)}</span>
            {recipe.reviewCount > 0 && <span className="text-slate-400">({recipe.reviewCount} đánh giá)</span>}
          </div>
        )}
        <h4 className="font-display text-base font-bold text-ink group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug">
          {recipe.title}
        </h4>
        {recipe.description && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{recipe.description}</p>}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="px-2 py-1 rounded-lg bg-emerald-50 text-[11px] font-bold text-emerald-700 truncate">
            {formatMetric(recipe.macros.protein, 'g')} Protein
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-orange-500 group-hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-0.5 shrink-0 transition-colors">
            Xem công thức
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );

  const mealTabButton = (tab: 'lunch' | 'dinner' | 'snack', label: string) => (
    <button
      onClick={() => setActiveMealTab(tab)}
      className={`px-4 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
        activeMealTab === tab ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      {/* ======================= GUEST MODE HERO ======================= */}
      {isGuest && (
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-100/70 via-canvas to-surface px-6 py-10 sm:px-10 sm:py-14">
          <div className="absolute -top-24 left-1/3 w-96 h-96 rounded-full bg-orange-200/40 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="space-y-5 max-w-xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 text-[11px] font-bold text-orange-700">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Khách tham quan • Trải nghiệm thư viện ẩm thực thông minh
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-ink leading-[1.15]">
                Khám phá thế giới <span className="text-orange-500">ẩm thực thông minh</span> cùng ChefAI
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Hàng ngàn công thức chuẩn vị, tính toán dinh dưỡng tức thì từ AI. Đăng ký tài khoản miễn phí để mở khóa tính năng đề xuất theo khẩu vị riêng & tình trạng sức khỏe cá nhân.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={onOpenRegisterModal}
                  className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/25 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Đăng ký trải nghiệm ngay (Miễn phí)
                </button>
                <button
                  onClick={() => onOpenChatWithPrompt('Gợi ý cho tôi bữa trưa dưới 400 Kcal, nấu trong 20 phút!')}
                  className="px-5 py-3 bg-white hover:bg-orange-50 text-ink rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <ChefHat className="w-4 h-4 text-orange-500" />
                  Dùng thử Chatbot AI Bếp Trưởng
                </button>
              </div>

              {/* Số liệu hệ thống */}
              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { value: totalRecipes > 0 ? String(totalRecipes) : '—', label: 'Món ăn & Công thức', tone: 'text-orange-600' },
                  { value: '24/7', label: 'Bếp trưởng AI tư vấn', tone: 'text-emerald-600' },
                  { value: '0đ', label: 'Phí khởi tạo vĩnh viễn', tone: 'text-orange-600' },
                ].map(stat => (
                  <div key={stat.label} className="min-w-[120px] px-4 py-3 bg-white rounded-2xl shadow-xs">
                    <div className={`font-display text-2xl font-bold ${stat.tone}`}>{stat.value}</div>
                    <div className="text-[11px] font-semibold text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget Bếp Trưởng AI */}
            <div className="w-full lg:w-[420px] bg-white rounded-3xl p-5 shadow-2xl shadow-slate-900/10 space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Bếp Trưởng ChefAI</h4>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Trực tuyến • Phân tích Calo tức thì
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-mint/60 text-emerald-800">Dùng thử</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-surface rounded-2xl rounded-tl-sm text-slate-700 leading-relaxed max-w-[90%]">
                  Chào bạn! Hôm nay bạn có nguyên liệu gì, hoặc cần thực đơn bao nhiêu calo? Mình gợi ý ngay!
                </div>
                <div className="p-3 bg-orange-500 text-white rounded-2xl rounded-tr-sm ml-auto max-w-[85%] leading-relaxed font-medium">
                  {widgetData.userPrompt}
                </div>

                {widgetLoading ? (
                  <div className="p-4 bg-orange-50 rounded-2xl flex items-center justify-center gap-2 text-orange-600 font-medium">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Bếp Trưởng AI đang tính toán calo & nguyên liệu...
                  </div>
                ) : (
                  <div className="p-3.5 bg-surface rounded-2xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink">{widgetData.dishTitle}</span>
                      <span className="font-bold text-emerald-600 shrink-0">{formatMetric(widgetData.dishCalo, ' kcal')}</span>
                    </div>
                    <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${caloPercent(widgetData.dishCalo)}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Đạm: {formatMetric(widgetData.protein, 'g')} • Tinh bột: {formatMetric(widgetData.carbs, 'g')}</span>
                      <span className="text-orange-600 flex items-center gap-1"><Clock className="w-3 h-3" />{formatMetric(widgetData.dishTime)} phút</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['Giảm béo bụng', 'Ăn chay giàu đạm', 'Vét tủ lạnh'].map(label => (
                  <button
                    key={label}
                    onClick={() => handleWidgetAsk(
                      label === 'Giảm béo bụng' ? 'Gợi ý thực đơn giảm béo bụng'
                        : label === 'Ăn chay giàu đạm' ? 'Thực đơn ăn chay thanh tịnh giàu đạm'
                        : 'Gợi ý món từ trứng, cà chua và hành lá có sẵn trong tủ lạnh'
                    )}
                    className="px-2.5 py-1 bg-surface-2 hover:bg-orange-50 hover:text-orange-600 rounded-lg text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    {label} →
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (widgetQuery.trim()) handleWidgetAsk(widgetQuery.trim());
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={widgetQuery}
                  onChange={(e) => setWidgetQuery(e.target.value)}
                  placeholder="Gõ yêu cầu: món dưới 350 kcal..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-surface rounded-xl text-xs text-ink placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                <button
                  type="submit"
                  disabled={widgetLoading || !widgetQuery.trim()}
                  className="absolute right-1.5 w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                  title="Gửi câu hỏi"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* ======================= LOGGED-IN PERSONALIZED HUB ======================= */}
      {!isGuest && (
        <section className="space-y-6">
          {/* Lời chào & trạng thái hồ sơ */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-ink">
                {greeting}, {currentUser.name}! 👋
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                ChefAI đã chọn sẵn các món phù hợp với khẩu vị và mục tiêu của bạn. Sẵn sàng cho một bữa ăn tràn hương vị!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onGoToProfile}
                className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-orange-50 text-xs font-semibold text-ink transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                Hồ sơ khẩu vị: <strong className={hasTasteGoal ? 'text-emerald-600' : 'text-orange-600'}>{hasTasteGoal ? 'đã hoàn thiện' : 'chưa thiết lập'}</strong>
              </button>
              <button
                onClick={onGoToProfile}
                className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-orange-50 text-xs font-semibold text-ink transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                Điều chỉnh mục tiêu
              </button>
            </div>
          </div>

          {/* AI Insight: tổng hợp từ hồ sơ khẩu vị, lịch sử xem và gợi ý cá nhân hóa của máy chủ */}
          {!insightDismissed && (
            <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-50 via-[#f6f3ff] to-emerald-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-600">
                    AI Insight thời gian thực
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  </span>
                  <p className="text-sm text-ink leading-relaxed">
                    {hasTasteGoal ? (
                      <>
                        Mục tiêu:{' '}
                        <strong className="text-emerald-700">
                          {[currentUser.dietPreference, currentUser.targetCalories > 0 ? `${currentUser.targetCalories.toLocaleString('en-US')} kcal` : ''].filter(Boolean).join(' • ')}
                        </strong>
                      </>
                    ) : (
                      <>Bạn chưa đặt mục tiêu dinh dưỡng</>
                    )}
                    {allergyList.length > 0 && (
                      <> • Tránh: <strong className="text-rose-600">{allergyList.slice(0, 3).join(', ')}</strong></>
                    )}
                    {lastViewed && (
                      <> • Vừa xem: <strong className="text-orange-600">{lastViewed.name}</strong>{lastViewed.calories != null && ` (${formatMetric(lastViewed.calories, ' kcal')})`}</>
                    )}
                    {'. '}
                    {topRecommendation ? (
                      <>
                        Đề xuất {mealSlot}:{' '}
                        <button onClick={() => onSelectRecipe(topRecommendation)} className="font-bold text-ink underline decoration-orange-300 underline-offset-2 hover:text-orange-600 cursor-pointer">
                          {topRecommendation.title}
                        </button>
                        {topRecommendation.macros.calories != null && ` (${formatMetric(topRecommendation.macros.calories, ' kcal')})`}
                        {topRecommendation.recommendReasons?.[0] && <> — {topRecommendation.recommendReasons[0].toLowerCase()}</>}
                        .
                      </>
                    ) : (
                      <>
                        <button onClick={onGoToProfile} className="font-bold text-orange-600 hover:underline cursor-pointer">Hoàn thiện hồ sơ khẩu vị</button>
                        {' '}để nhận đề xuất món cho {mealSlot}.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {recsUpdatedAt && (
                  <span className="px-3 py-1.5 rounded-full bg-white text-[11px] font-semibold text-slate-600 shadow-xs">
                    Cập nhật lúc {recsUpdatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => setInsightDismissed(true)}
                  className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-xs cursor-pointer"
                  aria-label="Ẩn thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Món gợi ý vàng */}
          {currentGoldenMeal ? (
            <div className="bg-white rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] group grid grid-cols-1 md:grid-cols-2">
              <div className="relative min-h-[260px]">
                <img
                  src={currentGoldenMeal.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                  alt={currentGoldenMeal.title}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-mint text-[11px] font-bold text-emerald-800 flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {currentGoldenMeal.matchPercentage != null ? `${currentGoldenMeal.matchPercentage}%` : '—'} Khớp Khẩu Vị
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/90 text-[11px] font-bold text-ink flex items-center gap-1 shadow-xs">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {formatMetric(currentGoldenMeal.cookingTime)} phút
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Gợi ý vàng hôm nay</span>
                  <span className="text-xs font-bold text-ink flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    {formatMetric(currentGoldenMeal.macros.calories, ' kcal')}
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-ink leading-snug group-hover:text-orange-600 transition-colors">
                    {currentGoldenMeal.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">{currentGoldenMeal.description}</p>
                  {currentGoldenMeal.recommendReasons && currentGoldenMeal.recommendReasons.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {currentGoldenMeal.recommendReasons.map(reason => (
                        <li key={reason} className="text-xs text-emerald-700 font-semibold flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Phân bổ đa lượng */}
                <div className="p-4 rounded-2xl bg-surface space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600">Phân bổ đa lượng (Macros)</span>
                    {currentGoldenMeal.tags?.[0] && <span className="text-emerald-600">#{currentGoldenMeal.tags[0]}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="h-1.5 rounded-full bg-orange-500 mb-1.5" />
                      <div className="text-[11px] text-slate-500 font-semibold">Đạm</div>
                      <div className="text-sm font-bold text-ink">{formatMetric(currentGoldenMeal.macros.protein, 'g')}</div>
                    </div>
                    <div>
                      <div className="h-1.5 rounded-full bg-emerald-600 mb-1.5" />
                      <div className="text-[11px] text-slate-500 font-semibold">Carbs</div>
                      <div className="text-sm font-bold text-ink">{formatMetric(currentGoldenMeal.macros.carbs, 'g')}</div>
                    </div>
                    <div>
                      <div className="h-1.5 rounded-full bg-amber-400 mb-1.5" />
                      <div className="text-[11px] text-slate-500 font-semibold">Chất béo</div>
                      <div className="text-sm font-bold text-ink">{formatMetric(currentGoldenMeal.macros.fat, 'g')}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onSelectRecipe(currentGoldenMeal)}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Utensils className="w-4 h-4" />
                    Bắt đầu nấu
                  </button>
                  <button
                    onClick={onGoToPlanner}
                    className="px-4 py-2.5 bg-surface-2 hover:bg-orange-50 text-ink rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Bookmark className="w-4 h-4" />
                    Thêm vào thực đơn
                  </button>
                  <button
                    onClick={handleNextGoldenMeal}
                    className="p-2.5 rounded-xl bg-surface-2 text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
                    title="Đổi món khác"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-3xl text-xs text-slate-400">Đang tải món ăn từ máy chủ...</div>
          )}
        </section>
      )}

      {/* ======================= MÓN GỢI Ý ======================= */}
      <section className="space-y-6">
        {isGuest && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-500" />
                Lọc nhanh theo nhu cầu ẩm thực
              </h3>
              <span className="hidden sm:block text-xs font-semibold text-slate-500">Kéo ngang để xem thêm →</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {filterPills.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedFilter(tag)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedFilter === tag
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-white text-slate-700 shadow-xs hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-[11px] font-bold text-orange-600">
              {isGuest ? 'Xu hướng ẩm thực tuần này' : 'Thực đơn thiết kế riêng'}
            </span>
            <h2 className="text-3xl font-bold text-ink">
              {isGuest ? 'Món Ngon Được Yêu Thích Nhất' : 'Gợi Ý Món Ăn Từng Bữa Trong Ngày'}
            </h2>
          </div>

          {!isGuest ? (
            <div className="flex p-1 bg-surface-2 rounded-2xl text-xs font-bold overflow-x-auto no-scrollbar">
              {mealTabButton('lunch', `Bữa trưa đề xuất (${lunchCount})`)}
              {mealTabButton('dinner', `Bữa tối nhẹ bụng (${dinnerCount})`)}
              {mealTabButton('snack', `Snack & Năng lượng (${snackCount})`)}
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-500">Hiển thị: {displayedMeals.length} món gợi ý cho Khách</div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {displayedMeals.map(recipeCard)}
        </div>
      </section>

      {/* ======================= HÀNH VI 7 NGÀY / MỜI ĐĂNG KÝ ======================= */}
      {!isGuest ? (
        <section className="p-6 rounded-3xl bg-surface space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Khám Phá Dựa Trên Hành Vi 7 Ngày Qua
            </h3>
            {likedRecent.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {likedRecent.slice(0, 3).map(r => (
                  <span key={r.id} className="px-2.5 py-1 rounded-lg bg-white text-[11px] font-bold text-orange-600 shadow-xs">#{r.dishName}</span>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {recentRatings.length > 0
              ? `Bạn đã đánh giá ${recentRatings.length} món trong 7 ngày qua, trong đó ${likedRecent.length} món từ 4 sao trở lên.`
              : 'Bạn chưa đánh giá món nào trong 7 ngày qua. Hãy chấm sao các món đã nấu để ChefAI hiểu gu của bạn hơn.'}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-600">
              {personalRecipes.length > 0 && (
                <>Đang gợi ý <strong className="text-emerald-600">{personalRecipes.length}</strong> món hợp khẩu vị của bạn</>
              )}
            </span>
            <button onClick={onGoToProfile} className="font-bold text-orange-600 hover:underline cursor-pointer text-left">
              Xem phân tích khẩu vị chi tiết →
            </button>
          </div>
        </section>
      ) : (
        <section className="p-5 sm:p-6 rounded-3xl bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-mint/60 text-emerald-700 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                {totalRecipes > 0
                  ? `Bạn đang xem ${displayedMeals.length} trong số ${totalRecipes} công thức miễn phí`
                  : 'Bạn đang xem bản xem trước thư viện công thức'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Đăng ký để xem chi tiết từng bước nấu có canh thời gian và đề xuất thay thế nguyên liệu theo AI.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenRegisterModal}
            className="px-5 py-2.5 bg-white hover:bg-orange-50 text-orange-600 rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            Mở khóa toàn bộ thư viện →
          </button>
        </section>
      )}

      {/* Lối tắt cuối trang */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-50 to-surface flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-ink">Muốn biến tấu món ăn hôm nay?</h4>
              <p className="text-xs text-slate-600 mt-1">Nhờ Trợ lý Bếp AI thay thế nguyên liệu nếu tủ lạnh đang thiếu đồ.</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChatWithPrompt('Hôm nay tôi muốn nấu món gì đó nhanh dưới 20 phút từ nguyên liệu sẵn có')}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            Hỏi Bếp Trưởng
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-surface flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-ink">Lên kế hoạch thực đơn 7 ngày</h4>
              <p className="text-xs text-slate-600 mt-1">Cân bằng calo, phân bổ protein và vi chất hợp lý cho cả tuần.</p>
            </div>
          </div>
          <button
            onClick={onGoToPlanner}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            Xem Thực Đơn
          </button>
        </div>
      </section>
    </div>
  );
};
