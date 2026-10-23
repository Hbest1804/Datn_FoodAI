import { Recipe, Ingredient, CookingStep } from '../types';

export function formatDifficulty(diff?: string | null): string {
  if (!diff) return 'Dễ';
  const lower = diff.toLowerCase();
  if (lower === 'easy' || lower === 'dễ') return 'Dễ';
  if (lower === 'medium' || lower === 'vừa' || lower === 'trung bình') return 'Vừa';
  if (lower === 'hard' || lower === 'nâng cao' || lower === 'khó') return 'Nâng cao';
  return diff;
}

export function formatVND(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return '45.000 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'%3E%3Crect width='100' height='100' fill='%23cbd5e1'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23ffffff'/%3E%3Cpath d='M18 88C18 70.327 32.327 56 50 56C67.673 56 82 70.327 82 88H18Z' fill='%23ffffff'/%3E%3C/svg%3E";



export function normalizeDish(raw: any): Recipe {
  if (!raw) {
    throw new Error('Dish data is null or undefined');
  }

  const name = raw.name || raw.title || 'Món ăn ngon';
  const slug = raw.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const image = raw.image_url || raw.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
  const cookTime = raw.cook_time_minutes ?? raw.cookingTime ?? 20;

  // Category handling
  let categoryName = 'Món chính';
  let categorySlug = 'mon-chinh';
  if (typeof raw.category === 'string') {
    categoryName = raw.category;
    categorySlug = raw.categorySlug || 'mon-chinh';
  } else if (raw.category && typeof raw.category === 'object') {
    categoryName = raw.category.name || 'Món chính';
    categorySlug = raw.category.slug || 'mon-chinh';
  }

  // Nutrition / Macros handling
  const calo = raw.calories != null ? Number(raw.calories) : (raw.nutrition?.calories ?? raw.macros?.calories ?? 450);
  const protein = raw.protein_g != null ? Number(raw.protein_g) : (raw.nutrition?.protein_g ?? raw.macros?.protein ?? 30);
  const carbs = raw.carbs_g != null ? Number(raw.carbs_g) : (raw.nutrition?.carbs_g ?? raw.macros?.carbs ?? 40);
  const fat = raw.fat_g != null ? Number(raw.fat_g) : (raw.nutrition?.fat_g ?? raw.macros?.fat ?? 12);

  const macros = {
    calories: calo,
    protein: protein,
    carbs: carbs,
    fat: fat,
    sodium: raw.macros?.sodium ?? 380,
  };

  // Ingredients handling
  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : (raw.dish_ingredients || []);
  const ingredients: Ingredient[] = rawIngredients.map((item: any, idx: number) => {
    const ingName = item.name || item.ingredient?.name || `Nguyên liệu ${idx + 1}`;
    const qty = Number(item.quantity ?? item.amount ?? 1);
    const unit = item.unit || 'phần';
    const allergenName = item.allergen || item.allergen_group?.name || item.ingredient?.allergen_group?.name;
    return {
      id: item.id || item.ingredient_id || `ing-${idx}`,
      ingredient_id: item.ingredient_id || item.ingredient?.id,
      name: ingName,
      amount: qty,
      quantity: qty,
      unit: unit,
      is_optional: Boolean(item.is_optional),
      allergen: allergenName,
      allergen_group: item.allergen_group || item.ingredient?.allergen_group,
      isSafe: true,
    };
  });

  // Steps handling
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps: CookingStep[] = rawSteps.map((s: any, idx: number) => {
    const text = s.content || s.instruction || s.title || `Bước ${idx + 1}`;
    const duration = s.duration_minutes ?? s.durationMinutes ?? 5;
    return {
      order: s.order ?? idx + 1,
      stepNumber: s.stepNumber ?? s.order ?? idx + 1,
      title: s.title || `Bước ${idx + 1}`,
      durationMinutes: duration,
      duration_minutes: duration,
      content: text,
      instruction: text,
      chefTip: s.chefTip,
      image: s.image,
    };
  });

  // Tags handling
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags.map((t: any) => (typeof t === 'string' ? t : t.name)).filter(Boolean);
  } else if (Array.isArray(raw.dish_tags)) {
    tags = raw.dish_tags.map((dt: any) => dt.tag?.name).filter(Boolean);
  }
  if (tags.length === 0) {
    tags = ['Món Việt', 'Dễ làm', 'Bổ dưỡng'];
  }

  const avgRating = raw.avg_rating ?? raw.rating ?? 4.8;
  const ratingCount = raw.rating_count ?? raw.reviewCount ?? 12;
  const favoriteCount = raw.favorite_count ?? 0;
  const isFavorite = Boolean(raw.is_favorite ?? raw.isBookmarked ?? false);

  return {
    id: String(raw.id),
    code: raw.code || `DISH-${raw.id ? String(raw.id).slice(0, 6) : 'REC'}`,
    title: name,
    name: name,
    englishTitle: raw.englishTitle,
    slug: slug,
    image: image,
    image_url: image,
    category: categoryName,
    categorySlug: categorySlug,
    region_id: raw.region_id,
    region: raw.region,
    category_id: raw.category_id,
    cookingTime: cookTime,
    cook_time_minutes: cookTime,
    difficulty: formatDifficulty(raw.difficulty) as any,
    servings: raw.servings || 2,
    est_cost: raw.est_cost != null ? Number(raw.est_cost) : 65000,
    rating: avgRating,
    avg_rating: avgRating,
    reviewCount: ratingCount,
    rating_count: ratingCount,
    favorite_count: favoriteCount,
    matchPercentage: raw.match ? Math.round(raw.match.ratio * 100) : (raw.matchPercentage || 95),
    match: raw.match,
    macros: macros,
    nutrition: {
      calories: calo,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    },
    calories: calo,
    description: raw.description || `Món ${name} thơm ngon, chuẩn vị truyền thống và cân bằng dinh dưỡng.`,
    tags: tags,
    ingredients: ingredients,
    steps: steps,
    utensils: raw.utensils || ['Chảo chống dính', 'Nồi', 'Dao thớt'],
    status: raw.is_published ? 'published' : (raw.status || 'published'),
    is_published: raw.is_published ?? true,
    isAiGenerated: raw.isAiGenerated || false,
    isBookmarked: isFavorite,
    is_favorite: isFavorite,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    rating_summary: raw.rating_summary,
    my_rating: raw.my_rating,
    related_dishes: raw.related_dishes,
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Quản lý Danh sách đi chợ (Shopping List) lưu cục bộ
// ────────────────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  recipeTitle?: string;
  checked?: boolean;
  addedAt: number;
}

export function getShoppingList(): ShoppingItem[] {
  try {
    const raw = localStorage.getItem('culina_shopping_list');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShoppingList(items: ShoppingItem[]): void {
  try {
    localStorage.setItem('culina_shopping_list', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('culina_shopping_updated', { detail: items }));
  } catch (err) {
    console.warn('Failed to save shopping list:', err);
  }
}

export function addRecipeToShoppingList(recipe: Recipe): number {
  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) return 0;
  const current = getShoppingList();
  
  let addedCount = 0;
  const newItems = [...current];

  recipe.ingredients.forEach(ing => {
    const trimmed = (ing.name || '').trim();
    if (!trimmed) return;
    const amountStr = ing.amount ? `${ing.amount} ${ing.unit || ''}`.trim() : 'Vừa đủ';
    
    // Nếu đã có trong danh sách thì bổ sung tên món vào ghi chú
    const foundIndex = newItems.findIndex(i => i.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (foundIndex >= 0) {
      if (recipe.title && !newItems[foundIndex].recipeTitle?.includes(recipe.title)) {
        newItems[foundIndex].recipeTitle = newItems[foundIndex].recipeTitle 
          ? `${newItems[foundIndex].recipeTitle}, ${recipe.title}` 
          : recipe.title;
      }
    } else {
      newItems.push({
        id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: trimmed,
        amount: amountStr,
        recipeTitle: recipe.title,
        checked: false,
        addedAt: Date.now(),
      });
      addedCount++;
    }
  });

  saveShoppingList(newItems);
  return addedCount || recipe.ingredients.length;
}
