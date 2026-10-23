import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Flame, 
  Clock, 
  ChevronRight, 
  Heart, 
  Bookmark, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw, 
  ChefHat, 
  ShoppingCart, 
  Sliders, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  Utensils,
  Send
} from 'lucide-react';
import { UserProfile, Recipe } from '../types';
import { ChefLogo3D } from './ChefLogo3D';
import { apiService } from '../services/api';

interface DiscoveryViewProps {
  currentUser: UserProfile;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenChatWithPrompt: (prompt: string) => void;
  onOpenRegisterModal: () => void;
  onGoToProfile: () => void;
  onGoToPlanner: () => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  currentUser,
  recipes,
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
  const displayedMeals = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];

    if (isGuest) {
      if (selectedFilter === 'Tất cả') return recipes.slice(1, 5);
      const filtered = recipes.filter(r => {
        const text = `${r.title} ${r.description} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        if (selectedFilter.includes('15 phút')) return (r.cookingTime <= 20) || text.includes('sáng');
        if (selectedFilter.includes('Eat Clean')) return (r.macros?.calories < 500) || text.includes('clean') || text.includes('salad');
        if (selectedFilter.includes('chay')) return text.includes('chay') || text.includes('rau') || text.includes('nấm');
        if (selectedFilter.includes('Cơm nhà')) return text.includes('cơm') || text.includes('kho') || text.includes('xào') || text.includes('canh');
        if (selectedFilter.includes('Keto')) return (r.macros?.carbs < 25) || text.includes('keto');
        if (selectedFilter.includes('Tăng cơ') || selectedFilter.includes('đạm')) return (r.macros?.protein >= 25);
        return text.includes(selectedFilter.toLowerCase());
      });
      return filtered.length > 0 ? filtered.slice(0, 4) : recipes.slice(1, 5);
    }

    // For logged-in users: separate dishes per meal slot
    if (activeMealTab === 'lunch') {
      // Bữa trưa: Món chính giàu năng lượng, no lâu
      const lunchDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.macros?.calories >= 380) || text.includes('cơm') || text.includes('xào') || text.includes('kho') || text.includes('bò') || text.includes('gà');
      });
      return lunchDishes.length >= 2 ? lunchDishes.slice(0, 4) : recipes.slice(1, 5);
    }

    if (activeMealTab === 'dinner') {
      // Bữa tối: Thanh đạm, nhẹ bụng, ít calo/carbs hơn hoặc lấy slot khác để không trùng bữa trưa
      const dinnerDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.macros?.calories < 480) || text.includes('canh') || text.includes('hấp') || text.includes('súp') || text.includes('salad') || text.includes('cá');
      });
      // Nếu có món phân loại theo calo/từ khóa, ưu tiên hiển thị; nếu ít quá thì lấy các món từ vị trí thứ 5 trở đi để không trùng bữa trưa
      if (dinnerDishes.length >= 4) return dinnerDishes.slice(0, 4);
      const fallback = recipes.slice(5, 9);
      return fallback.length > 0 ? fallback : dinnerDishes;
    }

    if (activeMealTab === 'snack') {
      // Snack & Năng lượng: món nấu nhanh, sinh tố, tráng miệng, hoặc nhẹ bụng
      const snackDishes = recipes.filter(r => {
        const text = `${r.title} ${r.category} ${(r.tags || []).join(' ')}`.toLowerCase();
        return (r.cookingTime <= 20) || (r.macros?.calories < 320) || text.includes('snack') || text.includes('bánh') || text.includes('nước') || text.includes('tráng miệng') || text.includes('salad');
      });
      if (snackDishes.length >= 3) return snackDishes.slice(0, 4);
      const fallback = recipes.slice(9, 13);
      return fallback.length > 0 ? fallback : recipes.slice(0, 4);
    }

    return recipes.slice(1, 5);
  }, [recipes, isGuest, selectedFilter, activeMealTab]);

  // Live in-page AI widget state
  const [widgetQuery, setWidgetQuery] = useState('');
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetData, setWidgetData] = useState(() => {
    const first = recipes.length > 0 ? recipes[0] : null;
    return {
      userPrompt: 'Gợi ý món ăn dinh dưỡng phù hợp hôm nay nhé AI!',
      dishTitle: first ? first.title : 'Đang chọn món phù hợp...',
      dishCalo: first?.macros?.calories || 400,
      dishTime: first?.cookingTime || 20,
      protein: first?.macros?.protein || 30,
      carbs: first?.macros?.carbs || 35,
      barPercentage: 75,
    };
  });

  useEffect(() => {
    if (recipes.length > 0 && widgetData.dishTitle === 'Đang chọn món phù hợp...') {
      const first = recipes[0];
      setWidgetData(prev => ({
        ...prev,
        dishTitle: first.title,
        dishCalo: first.macros?.calories || 400,
        dishTime: first.cookingTime || 20,
        protein: first.macros?.protein || 30,
        carbs: first.macros?.carbs || 35,
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
          dishCalo: dishAny.calories || 420,
          dishTime: firstDish.cook_time_minutes || 20,
          protein: Math.round(dishAny.protein_g || 30),
          carbs: Math.round(dishAny.carbs_g || 35),
          barPercentage: 85,
        });
      } else {
        // Parse from AI text
        setWidgetData({
          userPrompt: promptText,
          dishTitle: reply.content.slice(0, 48) + '...',
          dishCalo: 380,
          dishTime: 15,
          protein: 30,
          carbs: 35,
          barPercentage: 75,
        });
      }
    } catch {
      const fallbackDish = recipes.length > 0 ? recipes[0] : null;
      if (fallbackDish) {
        setWidgetData({
          userPrompt: promptText,
          dishTitle: fallbackDish.title,
          dishCalo: fallbackDish.macros?.calories || 400,
          dishTime: fallbackDish.cookingTime || 20,
          protein: fallbackDish.macros?.protein || 30,
          carbs: fallbackDish.macros?.carbs || 35,
          barPercentage: 75,
        });
      }
    } finally {
      setWidgetLoading(false);
      setWidgetQuery('');
    }
  };

  const handleNextGoldenMeal = () => {
    setGoldenMealIndex(prev => prev + 1);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* ======================= GUEST MODE HERO ======================= */}
      {isGuest && (
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-3xl p-6 sm:p-10 border border-orange-200/70 shadow-xs">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/90 border border-orange-200/80 shadow-xs text-orange-900 text-xs font-bold">
                <ChefLogo3D size="sm" showSparkle={false} />
                <span>Trải nghiệm hệ sinh thái ẩm thực số thông minh cùng Bếp Trưởng AI</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Khám phá thế giới ẩm thực thông minh <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">cùng ChefAI</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Hàng ngàn công thức chuẩn vị, tính toán dinh dưỡng tức thì từ AI. Đăng ký tài khoản miễn phí để mở khóa tính năng đề xuất theo khẩu vị riêng & tình trạng sức khỏe cá nhân.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onOpenRegisterModal}
                  className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Đăng ký trải nghiệm ngay (Miễn phí)
                </button>
                <button
                  onClick={() => onOpenChatWithPrompt('Gợi ý cho tôi bữa trưa dưới 400 Kcal, nấu trong 20 phút!')}
                  className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <ChefHat className="w-4 h-4 text-orange-500" />
                  Dùng thử Chatbot AI Bếp Trưởng
                </button>
              </div>

              {/* System Highlights */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200/80">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">{recipes.length > 0 ? `${recipes.length}+` : 'Kho món'}</div>
                  <div className="text-xs text-slate-500">Món ăn chuẩn vị</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">Bếp trưởng AI</div>
                  <div className="text-xs text-slate-500">Tư vấn 24/7</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">Chuẩn hóa</div>
                  <div className="text-xs text-slate-500">Dinh dưỡng & calo</div>
                </div>
              </div>
            </div>

            {/* Interactive Live AI Chef Widget Card */}
            <div className="w-full lg:w-96 bg-white/95 rounded-3xl p-5 border border-orange-200/80 shadow-xl space-y-3 shrink-0">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      Bếp Trưởng ChefAI
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h4>
                    <span className="text-[10px] text-emerald-600 font-semibold">• Trực tuyến • Phân tích Calo tức thì</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                  AI Trực Tiếp
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-2xl rounded-tl-xs text-slate-700 leading-relaxed text-[11px]">
                  Chào bạn! Hôm nay trong tủ lạnh có nguyên liệu gì, hoặc bạn cần thực đơn bao nhiêu calo? Mình gợi ý ngay!
                </div>

                <div className="p-2.5 bg-orange-500 text-white rounded-2xl rounded-tr-xs ml-auto max-w-[90%] leading-relaxed font-medium text-[11px]">
                  {widgetData.userPrompt}
                </div>

                {widgetLoading ? (
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 flex items-center justify-center gap-2 text-xs text-orange-600 font-medium">
                    <Sparkles className="w-4 h-4 animate-spin text-orange-500" />
                    Bếp Trưởng AI đang tính toán calo & nguyên liệu...
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-2xl rounded-tl-xs border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{widgetData.dishTitle}</span>
                      <span className="font-bold text-orange-600 text-xs">{widgetData.dishCalo} kcal</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${widgetData.barPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Đạm: {widgetData.protein}g • Tinh bột: {widgetData.carbs}g</span>
                      <span>⏱ {widgetData.dishTime} phút</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick AI Prompts */}
              <div className="pt-1 flex flex-wrap gap-1.5 text-[10px]">
                <button
                  onClick={() => handleWidgetAsk('Gợi ý thực đơn giảm béo bụng')}
                  className="px-2 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 rounded-lg text-slate-600 font-medium transition-colors cursor-pointer"
                >
                  Giảm béo bụng →
                </button>
                <button
                  onClick={() => handleWidgetAsk('Thực đơn ăn chay thanh tịnh giàu đạm')}
                  className="px-2 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 rounded-lg text-slate-600 font-medium transition-colors cursor-pointer"
                >
                  Ăn chay giàu đạm →
                </button>
                <button
                  onClick={() => handleWidgetAsk('Vét tủ lạnh: Tủ lạnh còn cá hồi và măng tây')}
                  className="px-2 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 rounded-lg text-slate-600 font-medium transition-colors cursor-pointer"
                >
                  Vét tủ lạnh →
                </button>
              </div>

              {/* Inline Input in Widget */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (widgetQuery.trim()) {
                    handleWidgetAsk(widgetQuery.trim());
                  }
                }}
                className="relative pt-1 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={widgetQuery}
                  onChange={(e) => setWidgetQuery(e.target.value)}
                  placeholder="Gõ yêu cầu: món dưới 350 kcal..."
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={widgetLoading || !widgetQuery.trim()}
                  className="absolute right-1.5 w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                  title="Gửi câu hỏi"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* ======================= LOGGED-IN PERSONALIZED HUB ======================= */}
      {!isGuest && (
        <section className="space-y-6">
          {/* Header Greeting & Realtime Sync Status */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  THỰC ĐƠN CÁ NHÂN HÓA THỜI GIAN THỰC
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Mục tiêu: {currentUser.dietPreference} • {currentUser.targetCalories} kcal/ngày
                </span>
              </div>
              <div className="flex items-center gap-3.5 mt-2">
                <ChefLogo3D size="md" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Chào buổi trưa, {currentUser.name}! 👋
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Hệ thống AI vừa tính toán lại dinh dưỡng theo nhịp độ buổi sáng của bạn. Sẵn sàng cho một bữa trưa tràn hương vị!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hồ sơ khẩu vị: <strong className="text-emerald-600 font-bold">{currentUser.isLoggedIn ? 'Đã kích hoạt' : 'Chưa lưu'}</strong></span>
              </div>
              <button
                onClick={onGoToProfile}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                Điều chỉnh mục tiêu
              </button>
            </div>
          </div>

          {/* AI Realtime Nutritional Insight Notification Banner */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl text-white shadow-md shadow-orange-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-md">
                    AI INSIGHT THỜI GIAN THỰC
                  </span>
                  <span className="text-[11px] text-orange-100">Đã nạp: 650 kcal (Sáng)</span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed">
                  Hôm nay bạn cần nạp thêm <strong className="font-extrabold underline">45g Protein</strong> và <strong className="font-extrabold underline">chất béo Omega-3</strong> cho bữa trưa để hỗ trợ phục hồi cơ bắp. ChefAI đã chuẩn bị sẵn 4 đề xuất hoàn hảo.
                </p>
              </div>
            </div>
            <button
              onClick={handleNextGoldenMeal}
              className="px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
            >
              Tối ưu lại khẩu phần →
            </button>
          </div>

          {/* Golden Recommendation of the Day + Daily Macro Progress Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 2 Cols: Golden Recommendation Card */}
            {currentGoldenMeal ? (
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs relative overflow-hidden group">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="sm:w-1/2 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        {currentGoldenMeal.matchPercentage || 95}% Khớp Khẩu Vị
                      </span>
                      <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                        Món gợi ý vàng trưa nay
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug group-hover:text-orange-600 transition-colors">
                        {currentGoldenMeal.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {currentGoldenMeal.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {currentGoldenMeal.tags && currentGoldenMeal.tags.map(tag => (
                        <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Nutrients Metric Strip */}
                    <div className="grid grid-cols-4 gap-2 py-3 px-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Năng lượng</div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-900">{currentGoldenMeal.macros?.calories || 400} <span className="text-[10px] font-normal text-slate-500">kcal</span></div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Protein</div>
                        <div className="text-sm sm:text-base font-extrabold text-orange-600">{currentGoldenMeal.macros?.protein || 25}g</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Carbs</div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-900">{currentGoldenMeal.macros?.carbs || 35}g</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Chất béo</div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-900">{currentGoldenMeal.macros?.fat || 12}g</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => onSelectRecipe(currentGoldenMeal)}
                        className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        Bắt đầu nấu ngay
                      </button>
                      <button
                        onClick={onGoToPlanner}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Thêm vào thực đơn
                      </button>
                      <button
                        onClick={handleNextGoldenMeal}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Đổi món khác"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Image side */}
                  <div className="sm:w-1/2 relative rounded-2xl overflow-hidden min-h-[200px]">
                    <img
                      src={currentGoldenMeal.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                      alt={currentGoldenMeal.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      {currentGoldenMeal.cookingTime || 20} phút nấu
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 p-8 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-400 flex items-center justify-center">
                Đang tải món ăn từ máy chủ...
              </div>
            )}

            {/* 1 Col: Daily Nutrition Donut Progress Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tiến trình nạp mục tiêu
                  </h4>
                  <button onClick={onGoToProfile} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Donut Chart Simulation */}
                <div className="flex items-center justify-center py-4">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-slate-100"
                        strokeWidth="12"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className="stroke-orange-500"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * (1 - 0.53)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-2xl font-black text-slate-900">53%</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        1,110 / {currentUser.targetCalories} kcal
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Lines */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      Protein (Đạm sạch)
                    </span>
                    <span className="font-bold text-slate-900">{currentUser.todayConsumedProtein}g / {currentUser.targetProtein}g (61%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[61%] h-full bg-orange-500 rounded-full" />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Chất xơ tự nhiên
                    </span>
                    <span className="font-bold text-slate-900">22g / 30g (73%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[73%] h-full bg-emerald-500 rounded-full" />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      Lượng nước uống
                    </span>
                    <span className="font-bold text-slate-900">{currentUser.todayConsumedWaterLiters}L / {currentUser.todayTargetWaterLiters}L (72%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-[72%] h-full bg-blue-500 rounded-full" />
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/60 text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Bữa trưa này sẽ hoàn tất 95% mục tiêu Protein trong ngày của bạn.</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================= MEAL SUGGESTION TABS & GRID ======================= */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              {isGuest ? 'XU HƯỚNG ẨM THỰC TUẦN NÀY' : 'THỰC ĐƠN ĐỀ XUẤT THEO BỮA'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isGuest ? 'Món Ngon Được Yêu Thích Nhất' : 'Thực Đơn Cá Nhân Tuyển Chọn'}
            </h2>
          </div>

          {!isGuest ? (
            <div className="flex p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setActiveMealTab('lunch')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeMealTab === 'lunch' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bữa trưa hôm nay (4)
              </button>
              <button
                onClick={() => setActiveMealTab('dinner')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeMealTab === 'dinner' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bữa tối nhẹ bụng (4)
              </button>
              <button
                onClick={() => setActiveMealTab('snack')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeMealTab === 'snack' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Snack & Năng lượng (3)
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Hiển thị 4 món gợi ý cho Khách
            </div>
          )}
        </div>

        {/* Dietary Filter Pills for Guests */}
        {isGuest && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filterPills.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedFilter(tag)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedFilter === tag
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedMeals.map(recipe => (
            <div
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-4/3 overflow-hidden">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold shadow-xs">
                    {recipe.matchPercentage}% Match
                  </div>
                  <div className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 backdrop-blur-xs text-slate-600 hover:text-orange-600 transition-colors">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-400" />
                    {recipe.cookingTime} phút
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug">
                    {recipe.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-orange-600">{recipe.macros.calories} kcal</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600">{recipe.macros.protein}g Protein</span>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  {recipe.difficulty} làm • {recipe.category}
                </span>
                <span className="font-bold text-orange-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Xem công thức
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= WEEKLY BEHAVIOR & FRIDGE ZERO-WASTE ======================= */}
      {!isGuest ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Left: 7-Day behavior taste insight */}
          <div className="bg-gradient-to-br from-orange-50/70 to-amber-50/50 rounded-3xl p-6 border border-orange-200/70 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-800 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Khám Phá Dựa Trên Hành Vi 7 Ngày Qua Của Bạn
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Gu ẩm thực tuần: Chuộng bơ tỏi áp chảo & xốt chanh tươi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn đã chấm 5 sao cho 3 món có kỹ thuật áp chảo bơ tỏi và sốt chua thanh (lemon vinaigrette). ChefAI đã tự động tăng trọng số các món Địa Trung Hải thanh nhẹ trong danh sách gợi ý mỗi trưa.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Tỉ lệ hài lòng công thức: <strong className="text-emerald-600">98.4%</strong></span>
              <button onClick={onGoToProfile} className="font-bold text-orange-600 hover:underline cursor-pointer">
                Xem phân tích khẩu vị chi tiết →
              </button>
            </div>
          </div>

          {/* Right: Anti-waste fridge alert */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  CHỐNG LÃNG PHÍ TỦ LẠNH
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                  Ưu tiên hôm nay
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900">
                200g Măng tây tươi còn dư
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Được ghi nhận từ chuyến đi chợ 3 ngày trước. Đề xuất kết hợp ngay cùng món <strong className="text-slate-800 font-semibold">Cá hồi sốt bơ tỏi</strong> ở trên để đạt độ giòn ngon nhất trước ngày mai!
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => onOpenChatWithPrompt('Tủ lạnh còn 200g măng tây tươi, hãy gợi ý món xào hoặc áp chảo nhanh nhất')}
                className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Hỏi Chatbot nấu măng tây →
              </button>
              <button
                onClick={onGoToPlanner}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Kiểm tra tủ lạnh (6 món)
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Guest Upgrade Bar */
        <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg sm:text-xl font-bold">
                Bạn đang xem 4 trong số 50,000+ công thức miễn phí
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Đăng ký tài khoản để xem chi tiết từng bước nấu có canh thời gian, video 4K chuẩn Chef và đề xuất thay thế nguyên liệu theo AI.
            </p>
          </div>
          <button
            onClick={onOpenRegisterModal}
            className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl text-xs sm:text-sm font-bold shrink-0 transition-all shadow-md cursor-pointer"
          >
            Mở khóa toàn bộ thư viện →
          </button>
        </section>
      )}

      {/* Bottom Shortcuts */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
        <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Muốn biến tấu món ăn hôm nay?</h4>
            <p className="text-xs text-slate-500 mt-1">Nhờ Trợ lý Bếp AI thay thế nguyên liệu nếu tủ lạnh đang thiếu đồ.</p>
          </div>
          <button
            onClick={() => onOpenChatWithPrompt('Hôm nay tôi muốn nấu món gì đó nhanh dưới 20 phút từ nguyên liệu sẵn có')}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
          >
            Hỏi Bếp Trưởng
          </button>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Đi chợ cho cả tuần thuận tiện</h4>
            <p className="text-xs text-slate-500 mt-1">Tự động gom nguyên liệu của thực đơn đề xuất vào danh sách mua sắm.</p>
          </div>
          <button
            onClick={onGoToPlanner}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Tạo Danh Sách
          </button>
        </div>
      </section>
    </div>
  );
};
