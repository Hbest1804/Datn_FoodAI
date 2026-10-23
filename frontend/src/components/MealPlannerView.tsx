import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, 
  Sparkles, 
  Flame, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Check, 
  Clock, 
  ChefHat, 
  Share2,
  AlertCircle
} from 'lucide-react';
import { Recipe, UserProfile, FridgeItem } from '../types';
import { apiService } from '../services/api';
import { toast, showPrompt, showConfirm } from './NotificationModal';
import { 
  getShoppingList, 
  saveShoppingList, 
  addRecipeToShoppingList, 
  ShoppingItem 
} from '../utils/dishUtils';

interface MealPlannerViewProps {
  currentUser: UserProfile;
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenChatWithPrompt: (prompt: string) => void;
}

export const MealPlannerView: React.FC<MealPlannerViewProps> = ({
  currentUser,
  recipes,
  onOpenRecipe,
  onOpenChatWithPrompt,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Load fridge items from local storage (user real items)
  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>(() => {
    try {
      const saved = localStorage.getItem('culina_fridge');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => getShoppingList());

  // Đồng bộ danh sách đi chợ khi có thay đổi từ các modal công thức khác
  useEffect(() => {
    const handleUpdate = () => {
      setShoppingList(getShoppingList());
    };
    window.addEventListener('culina_shopping_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('culina_shopping_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Persist fridge items
  useEffect(() => {
    try {
      localStorage.setItem('culina_fridge', JSON.stringify(fridgeItems));
    } catch {}
  }, [fridgeItems]);

  // Compute 7 days of the current week dynamically
  const daysOfWeek = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

    return dayNames.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      return {
        day: name,
        date: dateStr,
        isToday,
      };
    });
  }, []);

  // Compute daily schedule for the selected day from available real dishes
  const dailySchedule = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];

    const dayDishes = [
      { slot: 'Bữa Sáng (07:30)', recipe: recipes[(selectedDayIndex * 3) % recipes.length] },
      { slot: 'Bữa Trưa (12:00)', recipe: recipes[(selectedDayIndex * 3 + 1) % recipes.length], highlight: true },
      { slot: 'Bữa Tối (19:00)', recipe: recipes[(selectedDayIndex * 3 + 2) % recipes.length] },
    ].filter(s => Boolean(s.recipe));

    return dayDishes;
  }, [recipes, selectedDayIndex]);

  // Dynamically calculate total calories for the selected day
  const totalCaloSelectedDay = useMemo(() => {
    return dailySchedule.reduce((sum, item) => sum + (item.recipe?.macros?.calories || 400), 0);
  }, [dailySchedule]);

  // Các thao tác với danh sách đi chợ
  const toggleShoppingItem = (id: string) => {
    const updated = shoppingList.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setShoppingList(updated);
    saveShoppingList(updated);
  };

  const removeShoppingItem = (id: string, name: string) => {
    const updated = shoppingList.filter(item => item.id !== id);
    setShoppingList(updated);
    saveShoppingList(updated);
    toast.info(`Đã xóa "${name}" khỏi danh sách đi chợ`, 'Danh sách đi chợ');
  };

  const handleAddCustomShoppingItem = async () => {
    const name = await showPrompt({
      title: 'Thêm món cần mua',
      message: 'Nhập tên thực phẩm / nguyên liệu cần đi chợ:',
      placeholder: 'VD: Dầu hào, Nước mắm, Rau cải cúc...',
      confirmText: 'Tiếp tục',
      required: true,
    });
    if (!name || !name.trim()) return;

    const amount = await showPrompt({
      title: 'Số lượng / Khối lượng',
      message: `Nhập định lượng cho "${name.trim()}":`,
      placeholder: 'VD: 1 chai, 500g, 2 mớ...',
      defaultValue: 'Vừa đủ',
      confirmText: 'Thêm vào giỏ',
    });
    if (amount === null) return;

    const newItem: ShoppingItem = {
      id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      amount: amount.trim() || 'Vừa đủ',
      recipeTitle: 'Tự thêm',
      checked: false,
      addedAt: Date.now(),
    };

    const updated = [newItem, ...shoppingList];
    setShoppingList(updated);
    saveShoppingList(updated);
    toast.success(`Đã thêm "${newItem.name}" vào danh sách đi chợ!`, 'Danh sách đi chợ');
  };

  const handleClearChecked = () => {
    const remaining = shoppingList.filter(item => !item.checked);
    const count = shoppingList.length - remaining.length;
    if (count === 0) return;
    setShoppingList(remaining);
    saveShoppingList(remaining);
    toast.success(`Đã dọn dẹp ${count} món đã mua xong!`, 'Danh sách đi chợ');
  };

  const handleClearAllShopping = async () => {
    if (shoppingList.length === 0) return;
    const ok = await showConfirm({
      title: 'Xóa toàn bộ danh sách đi chợ?',
      message: 'Bạn có chắc chắn muốn xóa tất cả nguyên liệu trong danh sách đi chợ không?',
      confirmText: 'Xóa tất cả',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    setShoppingList([]);
    saveShoppingList([]);
    toast.info('Đã xóa sạch danh sách đi chợ.', 'Danh sách đi chợ');
  };

  const handleLoadFromWeeklyPlan = () => {
    if (!recipes || recipes.length === 0) {
      toast.warning('Chưa có công thức nào để nạp nguyên liệu.', 'Danh sách đi chợ');
      return;
    }
    const candidateRecipes = recipes.slice(0, 7);
    let totalAdded = 0;
    candidateRecipes.forEach(r => {
      totalAdded += addRecipeToShoppingList(r);
    });
    setShoppingList(getShoppingList());
    toast.success(`Đã nạp nguyên liệu từ các món thực đơn tuần vào danh sách đi chợ!`, 'Nạp thành công');
  };

  const handleShareShoppingList = () => {
    if (shoppingList.length === 0) {
      toast.warning('Chưa có nguyên liệu nào để chia sẻ.', 'Danh sách đi chợ');
      return;
    }
    const lines = [
      '🛒 DANH SÁCH ĐI CHỢ - CHEFAI',
      '─────────────────────────',
      ...shoppingList.map((item, idx) => {
        const mark = item.checked ? '[x]' : '[ ]';
        const dishInfo = item.recipeTitle ? ` (Món: ${item.recipeTitle})` : '';
        return `${idx + 1}. ${mark} ${item.name} - ${item.amount}${dishInfo}`;
      }),
      '─────────────────────────',
      `Tổng cộng: ${shoppingList.length} món (${shoppingList.filter(i => i.checked).length} đã mua)`
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    toast.success('Đã sao chép danh sách mua sắm vào clipboard!', 'Chia sẻ thành công');
  };

  const handleAddFridgeItem = async () => {
    const name = await showPrompt({
      title: 'Thêm nguyên liệu tủ lạnh',
      message: 'Nhập tên nguyên liệu bạn đang có sẵn:',
      placeholder: 'VD: Thịt ba chỉ, Trứng gà, Cà chua...',
      confirmText: 'Tiếp tục',
      required: true,
    });
    if (!name || !name.trim()) return;

    const amount = await showPrompt({
      title: 'Số lượng / Khối lượng',
      message: `Nhập định lượng cho "${name.trim()}":`,
      placeholder: 'VD: 300g, 2 quả, 1 bó...',
      defaultValue: 'Vừa đủ',
      confirmText: 'Lưu vào tủ lạnh',
    });
    if (amount === null) return;

    setFridgeItems([
      ...fridgeItems,
      {
        id: `fr-${Date.now()}`,
        name: name.trim(),
        amount: amount.trim() || 'Vừa đủ',
        daysRemaining: 4,
        category: 'Rau củ',
      }
    ]);
    toast.success(`Đã thêm "${name.trim()}" vào tủ lạnh!`, 'Tủ lạnh thông minh');
  };

  const handleCleanFridgeWithAi = () => {
    if (fridgeItems.length === 0) {
      toast.warning('Tủ lạnh đang trống. Vui lòng thêm nguyên liệu vào tủ lạnh trước!', 'Tủ lạnh');
      return;
    }
    const listStr = fridgeItems.map(f => `${f.name} (${f.amount})`).join(', ');
    onOpenChatWithPrompt(`Tủ lạnh nhà tôi hiện có các nguyên liệu: ${listStr}. Hãy ưu tiên các món sắp hết hạn và lên công thức bữa ăn dinh dưỡng giúp tôi!`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            KẾ HOẠCH DINH DƯỠNG CÁ NHÂN HÓA
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
            Thực Đơn Tuần & Tủ Lạnh Thông Minh
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cân bằng dinh dưỡng 7 ngày với thực đơn món ăn phong phú, quản lý nguyên liệu chống lãng phí và xuất danh sách đi chợ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanFridgeWithAi}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ChefHat className="w-4 h-4" />
            Dọn Tủ Lạnh Cùng AI
          </button>
        </div>
      </div>

      {/* 7 Days Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {daysOfWeek.map((d, idx) => (
          <button
            key={d.day}
            onClick={() => setSelectedDayIndex(idx)}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedDayIndex === idx
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-orange-500/20'
                : 'bg-white border-slate-200 hover:border-orange-300 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>{d.day}</span>
              <span className={`text-[10px] ${selectedDayIndex === idx ? 'text-orange-400' : 'text-slate-400'}`}>{d.date}</span>
            </div>
            {d.isToday && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                Hôm nay
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Grid: Left 2 Cols (Daily Meals Schedule), Right 1 Col (Smart Fridge & Shopping List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Meals of Selected Day */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Lịch Trình Bữa Ăn: {daysOfWeek[selectedDayIndex].day} ({daysOfWeek[selectedDayIndex].date})
            </h3>
            {totalCaloSelectedDay > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Ước tính: {totalCaloSelectedDay} kcal / ngày
              </span>
            )}
          </div>

          <div className="space-y-4">
            {dailySchedule.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Chưa có món ăn nào trong thực đơn.</p>
                <p className="text-xs text-slate-400">Hãy tìm kiếm và thêm món ăn từ trang Khám Phá để lên kế hoạch tuần.</p>
              </div>
            ) : (
              dailySchedule.map((slot, i) => (
                <div
                  key={i}
                  onClick={() => onOpenRecipe(slot.recipe)}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    slot.highlight
                      ? 'bg-white border-orange-400 shadow-md ring-2 ring-orange-500/10'
                      : 'bg-white border-slate-200/80 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={slot.recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}
                      alt={slot.recipe.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600">
                        {slot.slot}
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {slot.recipe.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{slot.recipe.macros?.calories || 400} kcal</span>
                        <span>•</span>
                        <span className="text-orange-600 font-bold">{slot.recipe.macros?.protein || 20}g Đạm</span>
                        <span>•</span>
                        <span>⏱ {slot.recipe.cookingTime || 20} phút</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecipe(slot.recipe);
                      }}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Smart Fridge & Grocery List */}
        <div className="space-y-6">
          {/* Smart Fridge Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Tủ Lạnh Thông Minh ({fridgeItems.length})
                </h4>
              </div>
              <button
                onClick={handleAddFridgeItem}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm đồ
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Nguyên liệu thực tế bạn đang có trong tủ lạnh:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fridgeItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Tủ lạnh đang trống. Nhấn "+ Thêm đồ" để lưu nguyên liệu.
                </div>
              ) : (
                fridgeItems.map(item => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between ${
                      item.isExpiringSoon
                        ? 'bg-red-50/80 border-red-200 text-red-900'
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-1.5">
                        {item.name}
                        {item.isExpiringSoon && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-red-200 text-red-800">
                            CẦN NẤU SỚM
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Số lượng: {item.amount}
                      </div>
                    </div>
                    <button
                      onClick={() => setFridgeItems(fridgeItems.filter(f => f.id !== item.id))}
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleCleanFridgeWithAi}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gợi ý món vét sạch tủ lạnh
            </button>
          </div>

          {/* Grocery Shopping List Box */}
          <div id="shopping-list-section" className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Danh Sách Đi Chợ
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {shoppingList.length > 0 
                      ? `${shoppingList.filter(i => i.checked).length}/${shoppingList.length} món đã mua`
                      : 'Chưa có món nào'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleAddCustomShoppingItem}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                  title="Thêm món cần mua"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={handleShareShoppingList}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                  title="Sao chép danh sách"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {shoppingList.some(i => i.checked) && (
                  <button
                    onClick={handleClearChecked}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-[11px] font-semibold cursor-pointer"
                    title="Dọn các món đã mua"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {shoppingList.length > 0 && (
                  <button
                    onClick={handleClearAllShopping}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Xóa toàn bộ giỏ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {shoppingList.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100/60 text-emerald-600 mx-auto flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Giỏ đi chợ đang trống</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                      Nhấn nút <span className="font-semibold text-orange-600">"Đưa vào Danh sách đi chợ"</span> trong chi tiết bất kỳ món ăn nào, hoặc nạp nhanh từ thực đơn tuần.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={handleLoadFromWeeklyPlan}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      + Nạp nguyên liệu từ Thực đơn tuần
                    </button>
                    <button
                      onClick={handleAddCustomShoppingItem}
                      className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      + Tự thêm món cần mua
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {shoppingList.map(item => {
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center justify-between p-2 rounded-xl transition-all border ${
                          item.checked 
                            ? 'bg-slate-50/80 border-slate-100 opacity-60' 
                            : 'bg-white hover:bg-emerald-50/30 border-slate-200/60 shadow-2xs'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(item.checked)}
                            onChange={() => toggleShoppingItem(item.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold truncate ${
                                item.checked ? 'line-through text-slate-400' : 'text-slate-800'
                              }`}>
                                {item.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 font-medium rounded shrink-0">
                                {item.amount}
                              </span>
                            </div>
                            {item.recipeTitle && (
                              <p className="text-[10px] text-orange-600/80 truncate font-medium">
                                🍳 {item.recipeTitle}
                              </p>
                            )}
                          </div>
                        </label>
                        <button
                          onClick={() => removeShoppingItem(item.id, item.name)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all cursor-pointer shrink-0"
                          title="Xóa nguyên liệu này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[11px]">
                    <button
                      onClick={handleAddCustomShoppingItem}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm món khác
                    </button>
                    <button
                      onClick={handleLoadFromWeeklyPlan}
                      className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      + Nạp thêm từ thực đơn
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
