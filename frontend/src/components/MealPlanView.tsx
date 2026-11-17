import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Loader2,
  RefreshCw,
  Shuffle,
  X,
  Trash2,
  Sparkles,
  AlertTriangle,
  LogIn,
  Clock,
  Flame,
  Sunrise,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { MealKey, MealPlan, MealPlanItem, UserProfile } from '../types';
import { apiService } from '../api';
import { toast, showConfirm } from './NotificationModal';

interface MealPlanViewProps {
  currentUser: UserProfile;
  sessionChecked: boolean;
  onOpenLogin: () => void;
  onGoToTasteProfile: () => void;
}

const EMPTY: MealPlan = {
  week_start: null,
  week_end: null,
  days: [],
  summary: { dish_count: 0, item_count: 0, unavailable_count: 0 },
  warnings: [],
};

const MEAL_ICONS: Record<MealKey, React.ReactNode> = {
  breakfast: <Sunrise className="w-4 h-4 text-amber-500" />,
  lunch: <Sun className="w-4 h-4 text-orange-500" />,
  dinner: <Moon className="w-4 h-4 text-indigo-500" />,
};

const MEAL_HINTS: Record<MealKey, string> = {
  breakfast: '1–2 món',
  lunch: 'Mâm cơm 3–4 món',
  dinner: 'Mâm cơm 3–4 món',
};

const SHORT_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const ROLE_STYLES: Record<MealPlanItem['role'], string> = {
  breakfast_main: 'bg-amber-50 text-amber-700',
  breakfast_side: 'bg-pink-50 text-pink-700',
  soup: 'bg-sky-50 text-sky-700',
  main: 'bg-orange-50 text-orange-700',
  vegetable: 'bg-emerald-50 text-emerald-700',
};

const formatDate = (iso: string, withYear = false) => {
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
};

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD). */
const todayVN = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export const MealPlanView: React.FC<MealPlanViewProps> = ({ currentUser, sessionChecked, onOpenLogin, onGoToTasteProfile }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<MealPlan>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [week, setWeek] = useState<'current' | 'next'>('current');
  const [selectedDay, setSelectedDay] = useState(0);

  const hasPlan = Boolean(plan.week_start);

  // Mở sẵn ngày hôm nay nếu thực đơn là tuần hiện tại
  const pickInitialDay = (p: MealPlan) => {
    const idx = p.days.findIndex((d) => d.date === todayVN());
    setSelectedDay(idx >= 0 ? idx : 0);
  };

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const p = await apiService.mealPlan.get();
      setPlan(p);
      pickInitialDay(p);
    } catch (err: any) {
      setLoadError(err.message || 'Không tải được thực đơn tuần.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.isLoggedIn) load();
    else setLoading(false);
  }, [currentUser.isLoggedIn]);

  const run = async (key: string, action: () => Promise<MealPlan>, success?: string) => {
    setBusy(key);
    try {
      const p = await action();
      setPlan(p);
      if (success) toast.success(success, 'Thực đơn tuần');
      p.warnings?.forEach((w) => toast.warning(w));
      return p;
    } catch (err: any) {
      toast.error(err.message || 'Thao tác không thành công.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async () => {
    if (hasPlan) {
      const ok = await showConfirm({
        title: 'Gợi ý lại cả tuần?',
        message: 'Thực đơn hiện tại sẽ được thay bằng gợi ý mới, kể cả những món bạn đã đổi.',
        confirmText: 'Gợi ý lại',
        cancelText: 'Hủy',
        variant: 'warning',
        icon: 'alert',
      });
      if (!ok) return;
    }
    const p = await run('generate', () => apiService.mealPlan.generate(week), 'Đã gợi ý thực đơn cho cả tuần.');
    if (p) pickInitialDay(p);
  };

  const handleClear = async () => {
    const ok = await showConfirm({
      title: 'Xóa thực đơn tuần?',
      message: 'Toàn bộ món trong thực đơn tuần sẽ bị xóa. Thao tác này không hoàn tác được.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    run('clear', () => apiService.mealPlan.clear(), 'Đã xóa thực đơn tuần.');
  };

  const openDish = (dishId: string) => navigate({ search: `?dish=${dishId}` });

  const day = plan.days[selectedDay];
  const weekLabel = useMemo(
    () => (plan.week_start && plan.week_end ? `${formatDate(plan.week_start)} – ${formatDate(plan.week_end, true)}` : ''),
    [plan.week_start, plan.week_end]
  );

  // ── Chưa đăng nhập ─────────────────────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }
  if (!currentUser.isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center">
          <CalendarDays className="w-7 h-7 text-orange-500" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Thực đơn tuần</h1>
        <p className="text-sm text-slate-500">
          Đăng nhập để ChefAI gợi ý thực đơn sáng, trưa, tối cho cả tuần theo mâm cơm Việt, hợp khẩu vị và tránh nguyên liệu bạn kiêng.
        </p>
        <button
          onClick={onOpenLogin}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" /> Đăng nhập
        </button>
      </div>
    );
  }

  const weekSelect = (
    <select
      value={week}
      onChange={(e) => setWeek(e.target.value as 'current' | 'next')}
      className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
    >
      <option value="current">Tuần này</option>
      <option value="next">Tuần sau</option>
    </select>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-orange-500" />
            Thực đơn tuần
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {hasPlan
              ? `Tuần ${weekLabel} · ${plan.summary.dish_count} món khác nhau`
              : 'Gợi ý bữa sáng, trưa, tối cho 7 ngày theo mâm cơm Việt: canh, món mặn, rau xào.'}
          </p>
        </div>
        {hasPlan && (
          <div className="flex flex-wrap items-center gap-2">
            {weekSelect}
            <button
              onClick={handleGenerate}
              disabled={busy !== null}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {busy === 'generate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Gợi ý lại cả tuần
            </button>
            <button
              onClick={handleClear}
              disabled={busy !== null}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa thực đơn
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-red-200 font-bold text-xs cursor-pointer">
            Thử lại
          </button>
        </div>
      ) : !hasPlan ? (
        /* Chưa có thực đơn */
        <div className="p-8 sm:p-12 rounded-3xl border border-dashed border-slate-300 bg-white text-center space-y-4">
          <CalendarDays className="w-12 h-12 mx-auto text-orange-300" />
          <h2 className="text-lg font-bold text-slate-800">Bạn chưa có thực đơn tuần</h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            ChefAI sẽ xếp bữa sáng 1–2 món, bữa trưa và tối 3–4 món (canh, món mặn, rau xào) cho 7 ngày, ưu tiên món hợp khẩu vị
            và tự loại món có nguyên liệu bạn kiêng hoặc trái chế độ ăn trong hồ sơ.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {weekSelect}
            <button
              onClick={handleGenerate}
              disabled={busy !== null}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gợi ý thực đơn tuần
            </button>
          </div>
          <button onClick={onGoToTasteProfile} className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer">
            Cập nhật hồ sơ khẩu vị để gợi ý chính xác hơn
          </button>
        </div>
      ) : (
        <>
          {plan.summary.unavailable_count > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Có {plan.summary.unavailable_count} món trong thực đơn không còn khả dụng. Hãy bấm đổi món để thay bằng món khác.
              </span>
            </div>
          )}

          {/* Chọn ngày */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {plan.days.map((d, idx) => {
              const isToday = d.date === todayVN();
              const active = idx === selectedDay;
              return (
                <button
                  key={d.day_index}
                  onClick={() => setSelectedDay(idx)}
                  className={`py-2 sm:py-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-black">
                    <span className="sm:hidden">{SHORT_DAYS[idx]}</span>
                    <span className="hidden sm:inline">{d.label}</span>
                  </div>
                  <div className={`text-[10px] sm:text-xs font-semibold ${active ? 'text-orange-100' : 'text-slate-400'}`}>
                    {formatDate(d.date)}
                  </div>
                  {isToday && (
                    <div className={`text-[9px] font-bold uppercase mt-0.5 ${active ? 'text-white' : 'text-orange-500'}`}>Hôm nay</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ba bữa trong ngày */}
          {day && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {day.meals.map((m) => {
                const mealKey = `meal-${day.day_index}-${m.meal}`;
                return (
                  <div key={m.meal} className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          {MEAL_ICONS[m.meal]} {m.label}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {MEAL_HINTS[m.meal]}
                          {m.meal !== 'breakfast' && ' + cơm trắng'}
                        </div>
                      </div>
                      <button
                        onClick={() => run(mealKey, () => apiService.mealPlan.regenerateMeal(day.day_index, m.meal), `Đã gợi ý lại ${m.label.toLowerCase()} ${day.label}.`)}
                        disabled={busy !== null}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Gợi ý lại bữa này"
                      >
                        {busy === mealKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Gợi ý lại
                      </button>
                    </div>

                    <ul className="divide-y divide-slate-100 flex-1">
                      {m.items.length === 0 ? (
                        <li className="p-4 text-xs text-slate-400 italic">Chưa có món nào. Bấm “Gợi ý lại” để xếp món cho bữa này.</li>
                      ) : (
                        m.items.map((it) => {
                          const itemBusy = busy === `item-${it.id}`;
                          return (
                            <li key={it.id} className={`p-3 flex gap-3 ${it.dish.is_available ? '' : 'bg-amber-50/50'}`}>
                              <button
                                onClick={() => it.dish.is_available && openDish(it.dish.id)}
                                disabled={!it.dish.is_available}
                                className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer disabled:cursor-default"
                              >
                                {it.dish.image_url && <img src={it.dish.image_url} alt={it.dish.name} className="w-full h-full object-cover" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ROLE_STYLES[it.role]}`}>{it.role_label}</span>
                                <button
                                  onClick={() => it.dish.is_available && openDish(it.dish.id)}
                                  disabled={!it.dish.is_available}
                                  className="block text-sm font-bold text-slate-900 hover:text-orange-600 text-left leading-snug mt-0.5 cursor-pointer disabled:cursor-default disabled:hover:text-slate-900"
                                >
                                  {it.dish.name}
                                </button>
                                {it.dish.is_available ? (
                                  <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-0.5">
                                    {it.dish.cook_time_minutes ? (
                                      <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{it.dish.cook_time_minutes} phút</span>
                                    ) : null}
                                    {it.dish.calories ? (
                                      <span className="inline-flex items-center gap-0.5"><Flame className="w-3 h-3" />{Math.round(it.dish.calories)} kcal</span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="text-[11px] font-semibold text-amber-800 mt-0.5">Món không còn khả dụng – hãy đổi món</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <button
                                  onClick={() => run(`item-${it.id}`, () => apiService.mealPlan.swapItem(it.id))}
                                  disabled={busy !== null}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer disabled:opacity-50"
                                  title="Đổi món khác"
                                >
                                  {itemBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => run(`item-${it.id}`, () => apiService.mealPlan.removeItem(it.id))}
                                  disabled={busy !== null}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                  title="Gỡ món khỏi bữa"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            Thực đơn đã loại món có nguyên liệu bạn kiêng, món trái chế độ ăn và món bạn chấm từ 2 sao trở xuống.
            <button onClick={onGoToTasteProfile} className="font-semibold text-orange-600 hover:underline cursor-pointer">
              Cập nhật hồ sơ khẩu vị
            </button>
          </p>
        </>
      )}
    </div>
  );
};
