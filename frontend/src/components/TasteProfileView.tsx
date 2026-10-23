import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  Save, 
  Sliders, 
  ShieldCheck, 
  Lock, 
  Check, 
  Plus, 
  X, 
  Flame, 
  ChefHat, 
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Users,
  Search,
  Heart,
  Ban,
  Loader2,
  Utensils,
  ArrowDown
} from 'lucide-react';
import { UserProfile, BackendTasteProfile, MetaFilters } from '../types';
import { apiService } from '../services/api';
import { formatVND } from '../utils/dishUtils';
import { toast, showConfirm } from './NotificationModal';

interface TasteProfileViewProps {
  currentUser: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

export const TasteProfileView: React.FC<TasteProfileViewProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  // Backend Taste Profile State
  const [profile, setProfile] = useState<BackendTasteProfile>({
    preferred_region_id: null,
    taste_prefs: {
      spicy_level: 0,
      salty_level: 2,
      sweet_level: 1,
      sour_level: 1,
      liked_ingredient_ids: [],
    },
    calorie_goal: 2000,
    budget_min: 30000,
    budget_max: 100000,
    household_size: 1,
    diet_type_ids: [],
    allergen_group_ids: [],
    disliked_ingredient_ids: [],
    preferred_region: null,
    diet_types: [],
    allergen_groups: [],
    disliked_ingredients: [],
    completeness: 0,
  });

  const [metaFilters, setMetaFilters] = useState<MetaFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Liked ingredients with friendly names
  const [likedIngredients, setLikedIngredients] = useState<Array<{ id: number; name: string }>>([]);
  // Quick popular ingredient suggestions
  const [popularIngredients, setPopularIngredients] = useState<Array<{ id: number; name: string }>>([]);

  // Ingredient search for like / dislike
  const [ingSearchInput, setIngSearchInput] = useState('');
  const [ingSuggestions, setIngSuggestions] = useState<Array<{ id: number; name: string }>>([]);
  const [ingMode, setIngMode] = useState<'liked' | 'disliked'>('liked');

  const sensoryLabels = {
    spiciness: ['Không cay (0)', 'The nhẹ (1)', 'Vừa miệng (2)', 'Cay nồng (3)', 'Cay đậm (4)', 'Siêu cay (5)'],
    salty_level: ['Rất nhạt (0)', 'Nhạt thanh (1)', 'Đậm vừa (2)', 'Mặn mà (3)', 'Đậm đà (4)', 'Rất mặn (5)'],
    sweet_level: ['Không đường (0)', 'Ngọt dịu (1)', 'Ngọt thanh (2)', 'Hơi ngọt (3)', 'Ngọt đậm (4)', 'Rất ngọt (5)'],
    sour_level: ['Không chua (0)', 'Thoang thoảng (1)', 'Dịu nhẹ (2)', 'Chua thanh (3)', 'Chua giòn (4)', 'Chua gắt (5)'],
  };

  // 1. Fetch initial profile & metadata from Backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      apiService.me.getTasteProfile().catch(() => null),
      apiService.meta.getFilters().catch(() => null),
      apiService.ingredients.getIngredients({ limit: 100 }).catch(() => null),
    ]).then(([backendProf, filters, ingredientsData]) => {
      if (!isMounted) return;
      if (backendProf) {
        setProfile(backendProf);
      }
      if (filters) {
        setMetaFilters(filters);
      }

      // Populate liked ingredients map from master list if available
      const allIngs = ingredientsData?.data || [];
      if (allIngs.length > 0) {
        setPopularIngredients(allIngs.slice(0, 10).map((i: any) => ({ id: i.id, name: i.name })));

        if (backendProf?.taste_prefs?.liked_ingredient_ids?.length) {
          const matchedLiked = backendProf.taste_prefs.liked_ingredient_ids.map((id: number) => {
            const found = allIngs.find((i: any) => i.id === id);
            return found ? { id: found.id, name: found.name } : { id, name: `Nguyên liệu #${id}` };
          });
          setLikedIngredients(matchedLiked);
        }
      }
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // 2. Ingredient autocomplete
  useEffect(() => {
    if (!ingSearchInput.trim() || ingSearchInput.length < 2) {
      setIngSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiService.ingredients.getIngredients({ q: ingSearchInput.trim(), limit: 6 });
        setIngSuggestions(res.data.map((i: any) => ({ id: i.id, name: i.name })));
      } catch {
        setIngSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [ingSearchInput]);

  // Real-time completeness score calculation
  const completenessScore = useMemo(() => {
    let score = 0;
    // 1. Sensory (20%)
    if (profile.taste_prefs) {
      if (typeof profile.taste_prefs.spicy_level === 'number') score += 5;
      if (typeof profile.taste_prefs.salty_level === 'number') score += 5;
      if (typeof profile.taste_prefs.sweet_level === 'number') score += 5;
      if (typeof profile.taste_prefs.sour_level === 'number') score += 5;
    }
    // 2. Nutrition & Budget (30%)
    if (profile.calorie_goal && profile.calorie_goal > 0) score += 15;
    if (profile.budget_min || profile.budget_max) score += 15;
    // 3. Portion & Diets (50%)
    if (profile.household_size && profile.household_size > 0) score += 20;
    if (profile.diet_type_ids && profile.diet_type_ids.length > 0) score += 15;
    if (profile.allergen_group_ids && profile.allergen_group_ids.length > 0) score += 15;
    return Math.min(100, Math.max(profile.completeness || 0, score));
  }, [profile]);

  // Handle Save Taste Profile (Single Form Submit)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSaving(true);

    // Frontend validation
    if (profile.budget_min && profile.budget_max && profile.budget_min > profile.budget_max) {
      setErrorMessage('Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.');
      setSaving(false);
      return;
    }

    try {
      const updated = await apiService.me.updateTasteProfile(profile);
      setProfile(updated);
      setSaveSuccessNotice(true);
      onUpdateUser({
        tasteAccuracy: Math.max(90, updated.completeness || completenessScore),
        dietPreference: updated.diet_types?.map((d: any) => d.name).join(', ') || 'Cân bằng',
        targetCalories: updated.calorie_goal || 2000,
      });
      setTimeout(() => setSaveSuccessNotice(false), 4000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error saving taste profile:', err);
      setErrorMessage(err.message || 'Lỗi khi lưu thông tin hồ sơ khẩu vị.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await showConfirm({
      title: 'Đặt lại khẩu vị mặc định',
      message: 'Bạn có muốn đặt lại các thông số khẩu vị về mức mặc định không? Các điều chỉnh trước đó sẽ được khôi phục.',
      confirmText: 'Đặt lại mặc định',
      cancelText: 'Giữ nguyên',
      variant: 'warning',
    });
    if (!ok) return;
    toast.info('Đã khôi phục các thông số khẩu vị về mức mặc định.');
    setProfile(prev => ({
      ...prev,
      taste_prefs: {
        spicy_level: 0,
        salty_level: 2,
        sweet_level: 1,
        sour_level: 1,
        liked_ingredient_ids: [],
      },
      calorie_goal: 2000,
      budget_min: 30000,
      budget_max: 100000,
      household_size: 1,
      diet_type_ids: [],
      allergen_group_ids: [],
      disliked_ingredient_ids: [],
      disliked_ingredients: [],
    }));
    setLikedIngredients([]);
  };

  const toggleDietType = (id: number) => {
    const exists = profile.diet_type_ids.includes(id);
    const updated = exists 
      ? profile.diet_type_ids.filter(d => d !== id)
      : [...profile.diet_type_ids, id];
    setProfile({ ...profile, diet_type_ids: updated });
  };

  const toggleAllergenGroup = (id: number) => {
    const exists = profile.allergen_group_ids.includes(id);
    const updated = exists 
      ? profile.allergen_group_ids.filter(a => a !== id)
      : [...profile.allergen_group_ids, id];
    setProfile({ ...profile, allergen_group_ids: updated });
  };

  const addIngredientToPool = (item: { id: number; name: string }) => {
    if (ingMode === 'liked') {
      if (!profile.taste_prefs.liked_ingredient_ids.includes(item.id)) {
        // remove from disliked if present
        const cleanDisliked = profile.disliked_ingredient_ids.filter(id => id !== item.id);
        const cleanDislikedItems = profile.disliked_ingredients.filter(i => i.id !== item.id);
        setProfile(prev => ({
          ...prev,
          disliked_ingredient_ids: cleanDisliked,
          disliked_ingredients: cleanDislikedItems,
          taste_prefs: {
            ...prev.taste_prefs,
            liked_ingredient_ids: [...prev.taste_prefs.liked_ingredient_ids, item.id],
          }
        }));
        setLikedIngredients(prev => [...prev.filter(i => i.id !== item.id), item]);
      }
    } else {
      if (!profile.disliked_ingredient_ids.includes(item.id)) {
        // remove from liked if present
        const cleanLiked = profile.taste_prefs.liked_ingredient_ids.filter(id => id !== item.id);
        setProfile(prev => ({
          ...prev,
          disliked_ingredient_ids: [...prev.disliked_ingredient_ids, item.id],
          disliked_ingredients: [...prev.disliked_ingredients.filter(i => i.id !== item.id), item],
          taste_prefs: {
            ...prev.taste_prefs,
            liked_ingredient_ids: cleanLiked,
          }
        }));
        setLikedIngredients(prev => prev.filter(i => i.id !== item.id));
      }
    }
    setIngSearchInput('');
    setIngSuggestions([]);
  };

  const removeLikedIngredient = (id: number) => {
    setProfile(prev => ({
      ...prev,
      taste_prefs: {
        ...prev.taste_prefs,
        liked_ingredient_ids: prev.taste_prefs.liked_ingredient_ids.filter(x => x !== id),
      }
    }));
    setLikedIngredients(prev => prev.filter(x => x.id !== id));
  };

  const removeDislikedIngredient = (id: number) => {
    setProfile(prev => ({
      ...prev,
      disliked_ingredient_ids: prev.disliked_ingredient_ids.filter(x => x !== id),
      disliked_ingredients: prev.disliked_ingredients.filter(x => x.id !== id),
    }));
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto pb-16">
      {/* ── Top Hero Header Card ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              HỒ SƠ KHẨU VỊ CÁ NHÂN HÓA
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hồ Sơ Khẩu Vị & Dinh Dưỡng Cá Nhân
            </h1>
            <p className="text-xs sm:text-sm text-orange-100 leading-relaxed">
              Thiết lập toàn diện sở thích vị giác, mức độ calo, ngân sách mỗi bữa và khóa an toàn dị ứng.
              Tất cả cấu hình được đồng bộ trực tiếp vào thuật toán gợi ý món ăn của CulinaAI.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                Độ hoàn thiện: {completenessScore}%
              </span>
              <span className="px-3 py-1 rounded-full bg-black/20 text-orange-100 text-xs font-medium">
                Khẩu phần: {profile.household_size} người
              </span>
              <span className="px-3 py-1 rounded-full bg-black/20 text-orange-100 text-xs font-medium">
                Calo: {profile.calorie_goal || 2000} kcal/ngày
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold text-xs backdrop-blur-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Đặt lại chuẩn
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-6 py-2.5 bg-white hover:bg-orange-50 disabled:opacity-50 text-orange-600 rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-orange-600" /> : <Save className="w-4 h-4 text-orange-600" />}
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ khẩu vị'}
            </button>
          </div>
        </div>

        {/* Completeness progress bar inside hero */}
        <div className="mt-6 pt-5 border-t border-white/20 space-y-1.5 relative z-10">
          <div className="flex justify-between text-xs font-bold text-orange-100">
            <span>Tiến độ hoàn thiện hồ sơ vị giác</span>
            <span className="text-white font-black">{completenessScore}%</span>
          </div>
          <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full bg-white transition-all duration-500 rounded-full shadow-xs"
              style={{ width: `${completenessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu thành công hồ sơ khẩu vị lên hệ thống! Thuật toán đề xuất món ăn đã được cập nhật ngay lập tức.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Quick In-Page Section Anchor Navigation ─────────────────────────── */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 uppercase px-3 shrink-0 flex items-center gap-1">
          <ArrowDown className="w-3 h-3" />
          Đi nhanh đến:
        </span>
        <button
          type="button"
          onClick={() => scrollToSection('sec-sensory')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-orange-500" />
          1. 4 Vị Giác Quan
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-macro')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          2. Calo & Ngân Sách
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-allergies')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
          3. Chế Độ Ăn & Khóa Dị Ứng
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('sec-ingredients')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <ChefHat className="w-3.5 h-3.5 text-amber-500" />
          4. Nguyên Liệu Thích & Kiêng
        </button>
      </div>

      {/* ── MAIN UNIFIED TASTE PROFILE FORM ─────────────────────────────────── */}
      <form onSubmit={handleSave} className="space-y-8">

        {/* ── SECTION 1: 4 Vị Giác Quan (Sensory Preferences) ─────────────────── */}
        <section id="sec-sensory" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center">
                  01
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Thang Đo 4 Vị Giác Quan (0 – 5)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Điều chỉnh vị giác theo sở thích cá nhân để mô hình AI tự động nêm nếm và gợi ý công thức phù hợp.
              </p>
            </div>
            <span className="p-2 bg-orange-50 text-orange-600 rounded-xl self-start sm:self-auto">
              <Sliders className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* 1. Độ Cay */}
            <div className="p-4 sm:p-5 rounded-2xl bg-orange-50/40 border border-orange-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Độ Cay (Spicy)
                </span>
                <span className="font-bold text-orange-600 bg-white border border-orange-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {sensoryLabels.spiciness[profile.taste_prefs.spicy_level]}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={profile.taste_prefs.spicy_level}
                onChange={(e) => setProfile({
                  ...profile,
                  taste_prefs: { ...profile.taste_prefs, spicy_level: parseInt(e.target.value, 10) }
                })}
                className="w-full accent-orange-500 cursor-pointer h-2 bg-orange-200/60 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                <span>0 (Không cay)</span>
                <span>2 (Vừa miệng)</span>
                <span>5 (Siêu cay)</span>
              </div>
            </div>

            {/* 2. Độ Mặn */}
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  Độ Mặn (Salty)
                </span>
                <span className="font-bold text-sky-600 bg-white border border-sky-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {sensoryLabels.salty_level[profile.taste_prefs.salty_level]}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={profile.taste_prefs.salty_level}
                onChange={(e) => setProfile({
                  ...profile,
                  taste_prefs: { ...profile.taste_prefs, salty_level: parseInt(e.target.value, 10) }
                })}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-sky-200/60 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                <span>0 (Rất nhạt)</span>
                <span>2 (Đậm vừa)</span>
                <span>5 (Rất mặn)</span>
              </div>
            </div>

            {/* 3. Độ Ngọt */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 border border-amber-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-amber-500" />
                  Độ Ngọt (Sweet)
                </span>
                <span className="font-bold text-amber-600 bg-white border border-amber-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {sensoryLabels.sweet_level[profile.taste_prefs.sweet_level]}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={profile.taste_prefs.sweet_level}
                onChange={(e) => setProfile({
                  ...profile,
                  taste_prefs: { ...profile.taste_prefs, sweet_level: parseInt(e.target.value, 10) }
                })}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-amber-200/60 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                <span>0 (Không đường)</span>
                <span>2 (Ngọt thanh)</span>
                <span>5 (Rất ngọt)</span>
              </div>
            </div>

            {/* 4. Độ Chua */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Độ Chua (Sour)
                </span>
                <span className="font-bold text-emerald-600 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {sensoryLabels.sour_level[profile.taste_prefs.sour_level]}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={profile.taste_prefs.sour_level}
                onChange={(e) => setProfile({
                  ...profile,
                  taste_prefs: { ...profile.taste_prefs, sour_level: parseInt(e.target.value, 10) }
                })}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-emerald-200/60 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                <span>0 (Không chua)</span>
                <span>2 (Dịu nhẹ)</span>
                <span>5 (Chua gắt)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Calo, Ngân Sách Bữa Ăn & Khẩu Phần ────────────────────── */}
        <section id="sec-macro" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 text-xs font-black flex items-center justify-center">
                  02
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Mục Tiêu Calo, Ngân Sách Bữa Ăn & Khẩu Phần
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tối ưu hóa năng lượng cần nạp, quy mô bữa ăn gia đình và mức ngân sách bữa ăn mong muốn.
              </p>
            </div>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl self-start sm:self-auto">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Quy mô gia đình */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                Số khẩu phần ăn (Người)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, household_size: Math.max(1, profile.household_size - 1) })}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={profile.household_size}
                  onChange={(e) => setProfile({ ...profile, household_size: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="flex-1 text-center py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, household_size: Math.min(15, profile.household_size + 1) })}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Định lượng nguyên liệu trong công thức sẽ tự động nhân theo số người.
              </span>
            </div>

            {/* 3. Mục tiêu Calo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-orange-500" />
                Mục tiêu Calo ngày (Kcal)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="800"
                  max="4500"
                  step="50"
                  value={profile.calorie_goal || 2000}
                  onChange={(e) => setProfile({ ...profile, calorie_goal: parseInt(e.target.value, 10) || 2000 })}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500"
                />
                <span className="text-xs font-bold text-slate-500 shrink-0">kcal/ngày</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1500, 2000, 2500].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setProfile({ ...profile, calorie_goal: val })}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                      profile.calorie_goal === val
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {val} kcal
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Ngân sách bữa ăn */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                Khoảng ngân sách mỗi bữa ăn (VNĐ)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    step="5000"
                    placeholder="Tối thiểu (VND)"
                    value={profile.budget_min || ''}
                    onChange={(e) => setProfile({ ...profile, budget_min: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Tối thiểu</span>
                </div>
                <div>
                  <input
                    type="number"
                    step="5000"
                    placeholder="Tối đa (VND)"
                    value={profile.budget_max || ''}
                    onChange={(e) => setProfile({ ...profile, budget_max: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Tối đa</span>
                </div>
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 pt-0.5">
                Khoảng hiện tại: {formatVND(profile.budget_min)} – {formatVND(profile.budget_max)}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Chế Độ Dinh Dưỡng & Khóa Dị Ứng ─────────────────────── */}
        <section id="sec-allergies" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center">
                  03
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Chế Độ Dinh Dưỡng & Khóa Dị Ứng Tuyệt Đối
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Các nguyên liệu chứa dị ứng sẽ bị AI loại trừ nghiêm ngặt khỏi mọi đề xuất và thực đơn tuần.
              </p>
            </div>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>

          {/* Diets */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase block">
              Chế độ dinh dưỡng áp dụng (Chọn một hoặc nhiều)
            </label>
            <div className="flex flex-wrap gap-2">
              {(metaFilters?.diet_types || [
                { id: 1, name: 'Bình thường' },
                { id: 2, name: 'Eat Clean' },
                { id: 3, name: 'Ăn chay' },
                { id: 4, name: 'Thuần chay' },
                { id: 5, name: 'Keto / Low-Carb' },
                { id: 6, name: 'Tăng cơ' },
              ]).map(dt => {
                const active = profile.diet_type_ids.includes(dt.id);
                return (
                  <button
                    key={dt.id}
                    type="button"
                    onClick={() => toggleDietType(dt.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                    {dt.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergens Hard Lock */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-rose-700 uppercase flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-500" />
                Khóa dị ứng thực phẩm nghiêm ngặt
              </label>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                AI bắt buộc loại trừ an toàn
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Nhấp chọn các nhóm thực phẩm bạn hoặc thành viên gia đình bị dị ứng. CulinaAI cam kết loại bỏ tuyệt đối.
            </p>

            <div className="flex flex-wrap gap-2">
              {(metaFilters?.allergen_groups || [
                { id: 1, name: 'Hải sản có vỏ' },
                { id: 2, name: 'Đậu phộng' },
                { id: 3, name: 'Sữa bò / Lactose' },
                { id: 4, name: 'Gluten' },
                { id: 5, name: 'Trứng' },
                { id: 6, name: 'Đậu nành' },
              ]).map(ag => {
                const active = profile.allergen_group_ids.includes(ag.id);
                return (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => toggleAllergenGroup(ag.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                        : 'bg-white border-rose-200 text-slate-700 hover:bg-rose-50'
                    }`}
                  >
                    {active ? <Lock className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-400" />}
                    {active ? `Khóa: ${ag.name}` : `+ ${ag.name}`}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Nguyên Liệu Thích & Kiêng ───────────────────────────── */}
        <section id="sec-ingredients" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 text-xs font-black flex items-center justify-center">
                  04
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Nguyên Liệu Yêu Thích & Nguyên Liệu Kiêng Cử
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tìm kiếm nguyên liệu chuẩn để đưa vào danh sách yêu thích hoặc danh sách loại bỏ.
              </p>
            </div>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl self-start sm:self-auto">
              <ChefHat className="w-4 h-4" />
            </span>
          </div>

          {/* Autocomplete Input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Chế độ thêm:</span>
              <button
                type="button"
                onClick={() => setIngMode('liked')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  ingMode === 'liked'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                Thêm vào Yêu thích
              </button>
              <button
                type="button"
                onClick={() => setIngMode('disliked')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  ingMode === 'disliked'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Thêm vào Kiêng cử
              </button>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={ingSearchInput}
                  onChange={(e) => setIngSearchInput(e.target.value)}
                  placeholder={`Nhập tên nguyên liệu để thêm vào danh sách ${ingMode === 'liked' ? 'Yêu thích' : 'Kiêng cử'} (ví dụ: thịt bò, nấm đùi gà, hành tây...)`}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:bg-white focus:border-orange-500 transition-all shadow-2xs"
                />
              </div>

              {/* Suggestions Dropdown */}
              {ingSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-1.5 divide-y divide-slate-50 max-h-56 overflow-y-auto">
                  {ingSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addIngredientToPool(item)}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-orange-50 text-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        ingMode === 'liked' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        + {ingMode === 'liked' ? 'Ưa thích' : 'Kiêng cử'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Popular quick add chips */}
            {popularIngredients.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400">Gợi ý nhanh:</span>
                {popularIngredients.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addIngredientToPool(item)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 text-[11px] font-medium border border-slate-200/80 transition-colors cursor-pointer"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Liked & Disliked Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            {/* Liked list */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  Nguyên liệu ưa thích ({likedIngredients.length})
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">Ưu tiên xuất hiện</span>
              </div>

              {likedIngredients.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2">
                  Chưa có nguyên liệu yêu thích nào. Tìm kiếm và thêm bên trên.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {likedIngredients.map(item => (
                    <span 
                      key={item.id} 
                      className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 flex items-center gap-1.5 shadow-2xs"
                    >
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeLikedIngredient(item.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                        title="Xóa"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Disliked list */}
            <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  Nguyên liệu kiêng cử ({profile.disliked_ingredients.length})
                </span>
                <span className="text-[10px] text-rose-700 font-semibold">Loại khỏi gợi ý</span>
              </div>

              {profile.disliked_ingredients.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2">
                  Chưa có nguyên liệu kiêng nào. Tìm kiếm và thêm bên trên.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.disliked_ingredients.map(item => (
                    <span 
                      key={item.id} 
                      className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-xs font-semibold text-rose-900 flex items-center gap-1.5 shadow-2xs"
                    >
                      {item.name}
                      <button
                        type="button"
                        onClick={() => removeDislikedIngredient(item.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                        title="Xóa"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── UNIFIED FORM BOTTOM ACTION BAR ─────────────────────────────────── */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 text-center sm:text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Mọi thay đổi sẽ được lưu đồng bộ ngay vào hồ sơ cá nhân của bạn.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Đặt lại chuẩn
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
              {saving ? 'Đang lưu...' : 'Lưu tất cả thay đổi'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
