import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  RotateCcw, 
  Clock, 
  Bookmark, 
  Flame, 
  ChevronRight, 
  Sparkles, 
  Mic, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  Check, 
  X, 
  ChefHat,
  Refrigerator,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Recipe, UserProfile, MetaFilters } from '../types';
import { apiService } from '../services/api';
import { formatVND, formatDifficulty } from '../utils/dishUtils';

interface SearchFilterViewProps {
  currentUser: UserProfile;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenChatWithPrompt: (prompt: string, fridgeContext?: string[]) => void;
  initialSearchQuery?: string;
}

export const SearchFilterView: React.FC<SearchFilterViewProps> = ({
  currentUser,
  recipes: initialRecipes,
  onSelectRecipe,
  onOpenChatWithPrompt,
  initialSearchQuery = '',
}) => {
  // Query & pagination state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters from Backend Meta
  const [metaFilters, setMetaFilters] = useState<MetaFilters | null>(null);

  // Selected filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | undefined>(undefined);
  const [maxCookTime, setMaxCookTime] = useState<number | undefined>(undefined);
  const [maxCalories, setMaxCalories] = useState<number>(700);
  const [sortBy, setSortBy] = useState<'relevance' | 'match' | 'newest' | 'rating' | 'popular' | 'cook_time' | 'calories'>('relevance');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Smart Fridge State (Tủ lạnh thông minh)
  const [fridgeIngredients, setFridgeIngredients] = useState<Array<{ id: number; name: string }>>(() => {
    try {
      const saved = localStorage.getItem('culina_fridge');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => ({
            id: typeof item.id === 'number' ? item.id : idx + 1,
            name: item.name || String(item)
          }));
        }
      }
    } catch {}
    return [];
  });
  const [ingredientSearchInput, setIngredientSearchInput] = useState('');
  const [ingredientSuggestions, setIngredientSuggestions] = useState<Array<{ id: number; name: string }>>([]);
  const [onlyReadyToCook, setOnlyReadyToCook] = useState(false); // min_match_ratio = 1

  // Results
  const [displayRecipes, setDisplayRecipes] = useState<Recipe[]>(initialRecipes);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [suggestAi, setSuggestAi] = useState(false);

  const trendingTags = [
    '#PhởBò',
    '#CáHồi',
    '#Dưới30Phút',
    '#ÍtCalo',
    '#MónKhoĐậmĐà',
    '#EatClean'
  ];

  // 1. Fetch Meta Filters on Mount
  useEffect(() => {
    let isMounted = true;
    apiService.meta.getFilters().then(filters => {
      if (isMounted) setMetaFilters(filters);
    });
    return () => { isMounted = false; };
  }, []);

  // 2. Autocomplete Ingredient suggestions
  useEffect(() => {
    if (!ingredientSearchInput.trim() || ingredientSearchInput.length < 2) {
      setIngredientSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiService.ingredients.getIngredients({ q: ingredientSearchInput.trim(), limit: 6 });
        setIngredientSuggestions(res.data.map(i => ({ id: i.id, name: i.name })));
      } catch {
        setIngredientSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [ingredientSearchInput]);

  // 3. Search Dishes with backend API
  const fetchDishes = useCallback(async () => {
    setLoading(true);
    try {
      const ingredientIds = fridgeIngredients.map(i => i.id).join(',');
      const tagIds = selectedTagIds.join(',');

      const result = await apiService.dishes.getDishes({
        q: searchQuery.trim() || undefined,
        category_id: selectedCategoryId,
        ingredient_ids: ingredientIds || undefined,
        min_match_ratio: onlyReadyToCook ? 1 : undefined,
        tag_ids: tagIds || undefined,
        difficulty: selectedDifficulty,
        max_cook_time: maxCookTime,
        max_calories: maxCalories < 800 ? maxCalories : undefined,
        sort: sortBy,
        page,
        limit: 12,
      });

      setDisplayRecipes(result.dishes);
      setTotalItems(result.total);
      setTotalPages(result.totalPages);
      setAiSuggestions(result.suggestions || []);
      setSuggestAi(result.suggestAi || false);
    } catch (err) {
      console.warn('Error fetching dishes:', err);
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    selectedCategoryId,
    selectedTagIds,
    selectedDifficulty,
    maxCookTime,
    maxCalories,
    sortBy,
    page,
    fridgeIngredients,
    onlyReadyToCook
  ]);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId(undefined);
    setSelectedTagIds([]);
    setSelectedDifficulty(undefined);
    setMaxCookTime(undefined);
    setMaxCalories(800);
    setFridgeIngredients([]);
    setOnlyReadyToCook(false);
    setSortBy('relevance');
    setPage(1);
  };

  const handleAddFridgeIngredient = (item: { id: number; name: string }) => {
    if (!fridgeIngredients.some(i => i.id === item.id)) {
      setFridgeIngredients([...fridgeIngredients, item]);
      setPage(1);
    }
    setIngredientSearchInput('');
    setIngredientSuggestions([]);
  };

  const handleFridgeInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = ingredientSearchInput.trim();
      if (!query) return;

      // 1. Nếu đã có danh sách gợi ý đang hiển thị, chọn gợi ý phù hợp nhất hoặc đầu tiên
      if (ingredientSuggestions.length > 0) {
        const exact = ingredientSuggestions.find(
          s => s.name.toLowerCase() === query.toLowerCase()
        ) || ingredientSuggestions[0];
        handleAddFridgeIngredient(exact);
        return;
      }

      // 2. Nếu người dùng vừa gõ và bấm Enter ngay, gọi API tìm nguyên liệu tức thì
      try {
        const res = await apiService.ingredients.getIngredients({ q: query, limit: 5 });
        if (res.data && res.data.length > 0) {
          const exact = res.data.find(
            (s: any) => s.name.toLowerCase() === query.toLowerCase()
          ) || res.data[0];
          handleAddFridgeIngredient({ id: exact.id, name: exact.name });
        } else {
          // Nếu nguyên liệu chưa có trong danh mục chuẩn, chuyển từ khóa sang tìm thẳng theo món ăn
          setSearchQuery(query);
          setIngredientSearchInput('');
          setIngredientSuggestions([]);
          setPage(1);
        }
      } catch (err) {
        console.warn('Lỗi tìm nguyên liệu khi nhấn Enter:', err);
      }
    }
  };

  const handleRemoveFridgeIngredient = (id: number) => {
    setFridgeIngredients(fridgeIngredients.filter(i => i.id !== id));
    setPage(1);
  };

  const toggleTagFilter = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
    setPage(1);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner and Search Bar */}
      <div className="p-6 sm:p-8 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/80 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              BỘ LỌC & TÌM KIẾM ẨM THỰC THÔNG MINH
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              Tìm kiếm & Lọc Món ăn Phù hợp
            </h1>
          </div>
          <div className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 font-semibold flex items-center gap-1.5 shadow-2xs self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Tìm theo tên món & nguyên liệu không dấu
          </div>
        </div>

        {/* Big Search Input */}
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute left-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fetchDishes();
              }
            }}
            placeholder="Ví dụ: Phở bò, cá hồi, măng tây, thịt heo, xào lăn..."
            className="w-full pl-12 pr-36 py-3.5 bg-white border-2 border-slate-200 hover:border-orange-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 rounded-2xl text-xs sm:text-sm font-medium outline-none shadow-xs transition-all"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            <button
              onClick={() => {
                setSearchQuery('Phở bò');
                setPage(1);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              title="Tìm mẫu"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchDishes()}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              Tìm kiếm
            </button>
          </div>
        </div>

        {/* Trending Tags */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <span className="font-bold text-slate-400 uppercase text-[11px] shrink-0">Xu hướng tìm kiếm:</span>
          {trendingTags.map(tag => (
            <button
              key={tag}
              onClick={() => {
                setSearchQuery(tag.replace('#', ''));
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-orange-400 text-slate-600 hover:text-orange-600 font-medium shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Filters, Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left 1 Col: Filter Sidebar */}
        <div className="space-y-6 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs h-fit">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <SlidersHorizontal className="w-4 h-4 text-orange-500" />
              Bộ Lọc Đa Chiều
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-slate-400 hover:text-orange-600 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Đặt lại
            </button>
          </div>

          {/* SMART FRIDGE MODULE (TỦ LẠNH THÔNG MINH - Section 4.3.1) */}
          <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-orange-950 flex items-center gap-1.5 uppercase">
                <ChefHat className="w-4 h-4 text-orange-600" />
                Tủ Lạnh Có Sẵn
              </label>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 uppercase">
                AI Match
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Chọn nguyên liệu trong tủ nhà bạn, hệ thống tính tỷ lệ khớp và tìm món ngay.
            </p>

            {/* Input Autocomplete */}
            <div className="relative">
              <input
                type="text"
                value={ingredientSearchInput}
                onChange={(e) => setIngredientSearchInput(e.target.value)}
                onKeyDown={handleFridgeInputKeyDown}
                placeholder="Thêm nguyên liệu (thịt bò, hành...)"
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs outline-none"
              />
              {ingredientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                  {ingredientSuggestions.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddFridgeIngredient(item)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 text-slate-700 flex items-center justify-between cursor-pointer"
                    >
                      <span>{item.name}</span>
                      <span className="text-[10px] text-orange-600 font-bold">+ Thêm</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Fridge Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {fridgeIngredients.map(item => (
                <span
                  key={item.id}
                  className="px-2.5 py-1 bg-white border border-orange-200 text-orange-900 rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs"
                >
                  {item.name}
                  <button
                    onClick={() => handleRemoveFridgeIngredient(item.id)}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {fridgeIngredients.length === 0 && (
                <span className="text-[11px] text-slate-400 italic">Chưa chọn nguyên liệu nào</span>
              )}
            </div>

            {/* Ready to cook checkbox (min_match_ratio = 1) */}
            {fridgeIngredients.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyReadyToCook}
                    onChange={(e) => {
                      setOnlyReadyToCook(e.target.checked);
                      setPage(1);
                    }}
                    className="accent-orange-500 rounded cursor-pointer"
                  />
                  <span className={onlyReadyToCook ? 'text-orange-700 font-bold' : ''}>
                    Chỉ hiện món nấu được ngay (Khớp 100%)
                  </span>
                </label>

                {/* Chuyển sang Chatbot AI với nguyên liệu này */}
                <button
                  type="button"
                  onClick={() => {
                    const names = fridgeIngredients.map(i => i.name).join(', ');
                    onOpenChatWithPrompt(
                      `Tôi đang có các nguyên liệu: ${names}. Hãy tư vấn công thức món ăn tối ưu nhất từ những nguyên liệu này giúp tôi!`,
                      fridgeIngredients.map(i => i.name)
                    );
                  }}
                  className="w-full py-2 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                  Chuyển sang Chatbot AI với nguyên liệu này
                </button>
              </div>
            )}
          </div>

          {/* Filter 1: Danh mục món ăn (Category) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase">
              Danh mục món ăn
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  setSelectedCategoryId(undefined);
                  setPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                  selectedCategoryId === undefined
                    ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tất cả
              </button>
              {(metaFilters?.categories || []).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id === selectedCategoryId ? undefined : cat.id);
                    setPage(1);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {selectedCategoryId === cat.id && '✓ '}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 2: Độ khó (Difficulty) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block uppercase">
              Mức độ thực hiện
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { key: 'easy', label: 'Dễ' },
                { key: 'medium', label: 'Vừa' },
                { key: 'hard', label: 'Nâng cao' },
              ].map(d => (
                <button
                  key={d.key}
                  onClick={() => {
                    setSelectedDifficulty(selectedDifficulty === d.key ? undefined : (d.key as any));
                    setPage(1);
                  }}
                  className={`py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    selectedDifficulty === d.key
                      ? 'bg-orange-50 border-orange-300 text-orange-700 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 4: Mức Calo Mục Tiêu */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-slate-700 uppercase">Calo tối đa</label>
              <span className="font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                Dưới {maxCalories} kcal
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="800"
              step="50"
              value={maxCalories}
              onChange={(e) => {
                setMaxCalories(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>200 kcal</span>
              <span>800+ kcal</span>
            </div>
          </div>

          {/* Filter 5: Tags ẩm thực & đặc sản */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 block uppercase">
              Thẻ khẩu vị & Đặc sản
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(metaFilters?.tags || []).map(t => {
                const active = selectedTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTagFilter(t.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-orange-50 border-orange-300 text-orange-700 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 3 Cols: Results Grid */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Sort & Count Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>
                Tìm thấy <strong className="text-orange-600">{totalItems}</strong> món ăn phù hợp
              </span>
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sort selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="relevance">Phù hợp nhất</option>
                  <option value="match">Khớp tủ lạnh nhất</option>
                  <option value="rating">Đánh giá cao nhất</option>
                  <option value="popular">Phổ biến nhất</option>
                  <option value="cook_time">Nấu nhanh nhất</option>
                  <option value="calories">Calo thấp đến cao</option>
                  <option value="newest">Mới cập nhật</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="hidden sm:flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewLayout('grid')}
                  className={`p-1 rounded cursor-pointer ${viewLayout === 'grid' ? 'bg-white shadow-2xs text-orange-600' : 'text-slate-400'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  className={`p-1 rounded cursor-pointer ${viewLayout === 'list' ? 'bg-white shadow-2xs text-orange-600' : 'text-slate-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* AI Suggestion if no direct dishes matched fridge */}
          {suggestAi && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Chưa có món nấu sẵn khớp 100% nguyên liệu tủ lạnh của bạn. Bạn có muốn Bếp trưởng AI sáng tạo công thức riêng?
                </span>
              </div>
              <button
                onClick={() => onOpenChatWithPrompt(`Tủ lạnh tôi có: ${fridgeIngredients.map(i => i.name).join(', ')}. Hãy sáng tạo món ngon Eat Clean giúp tôi!`)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shrink-0 cursor-pointer ml-3"
              >
                Hỏi AI Sáng Tạo Món →
              </button>
            </div>
          )}

          {/* Recipes Output Grid */}
          {displayRecipes.length === 0 && !loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
              <ChefHat className="w-12 h-12 text-orange-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy món ăn phù hợp với bộ lọc</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hãy thử bỏ bớt điều kiện lọc hoặc đặt lại bộ lọc để xem nhiều gợi ý ẩm thực hấp dẫn hơn.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            <div className={`grid gap-6 ${viewLayout === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {displayRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  onClick={() => onSelectRecipe(recipe)}
                  className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-16/10 overflow-hidden">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      
                      {/* Smart Fridge Match Badge */}
                      {recipe.match ? (
                        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1 text-white ${
                          recipe.match.ratio === 1 ? 'bg-emerald-600' : 'bg-orange-500'
                        }`}>
                          <Sparkles className="w-3 h-3" />
                          {recipe.match.ratio === 1 ? 'Nấu được ngay 100%' : `Khớp ${Math.round(recipe.match.ratio * 100)}%`}
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/70 backdrop-blur-xs text-white text-xs font-bold shadow-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-orange-400" />
                          {recipe.matchPercentage || 95}% Phù hợp
                        </div>
                      )}

                      <div className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-xs text-slate-600 hover:text-orange-600 transition-colors">
                        <Bookmark className="w-4 h-4" />
                      </div>
                      
                      <div className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-orange-400" />
                        {recipe.cookingTime} phút
                      </div>

                      {recipe.difficulty && (
                        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-bold">
                          {formatDifficulty(recipe.difficulty)}
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-orange-600 uppercase text-[10px] tracking-wider">
                          {recipe.category}
                        </span>
                        <span className="font-bold text-slate-700 flex items-center gap-0.5">
                          ★ {recipe.rating || 5.0} ({recipe.reviewCount || 0})
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug">
                        {recipe.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>

                      {/* Missing ingredients notice if available */}
                      {recipe.match && recipe.match.missing_count > 0 && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                          Thiếu: {recipe.match.missing_ingredients.slice(0, 2).join(', ')}
                          {recipe.match.missing_ingredients.length > 2 ? '...' : ''}
                        </div>
                      )}

                      {/* Macro Strip */}
                      <div className="flex items-center justify-between py-2 border-y border-slate-100 text-xs font-semibold text-slate-700">
                        <span>Calo: <strong className="text-orange-600">{recipe.macros.calories}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Đạm: {recipe.macros.protein}g</span>
                        <span className="text-slate-300">•</span>
                        <span>Carb: {recipe.macros.carbs}g</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecipe(recipe);
                      }}
                      className="w-full py-2.5 bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-600 font-bold text-xs rounded-xl border border-slate-200/80 hover:border-orange-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Xem chi tiết công thức
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer ${
                    page === pNum
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pNum}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Tiếp
              </button>
            </div>
          )}

          {/* Footer Fridge Cleaner Banner */}
          <div className="p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl border border-orange-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                DỌN SẠCH TỦ LẠNH • KHÔNG LÃNG PHÍ THỰC PHẨM
              </span>
              <h4 className="text-base font-bold text-slate-900">
                Bạn cần AI sáng tạo món mới theo nguyên liệu đang có?
              </h4>
              <p className="text-xs text-slate-500 max-w-xl">
                Gửi trực tiếp câu hỏi hoặc danh sách đồ ăn thừa trong tủ lạnh cho Trợ lý ChefAI, hệ thống AI thông minh sẽ tức thì lên thực đơn vừa khít và an toàn dị ứng!
              </p>
            </div>
            <button
              onClick={() => onOpenChatWithPrompt(`Tôi muốn dọn sạch tủ lạnh hôm nay với: ${fridgeIngredients.map(i => i.name).join(', ')}. Hãy gợi ý món ngon giúp tôi!`)}
              className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-orange-600/20 transition-all shrink-0 cursor-pointer"
            >
              Hỏi Chatbot AI Tạo Món Ngay →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
