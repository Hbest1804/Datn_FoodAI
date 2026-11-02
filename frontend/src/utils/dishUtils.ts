import { Recipe, Ingredient, CookingStep } from '../types';

export function formatDifficulty(diff?: string | null): string {
  if (!diff) return '';
  const lower = diff.toLowerCase();
  if (lower === 'easy' || lower === 'dễ') return 'Dễ';
  if (lower === 'medium' || lower === 'vừa' || lower === 'trung bình') return 'Vừa';
  if (lower === 'hard' || lower === 'nâng cao' || lower === 'khó') return 'Nâng cao';
  return diff;
}

export function formatVND(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/** Hiển thị chỉ số dinh dưỡng / thời gian; chưa có dữ liệu thì trả "—". */
export function formatMetric(value?: number | null, unit = ''): string {
  if (value == null || isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}${unit}`;
}

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'%3E%3Crect width='100' height='100' fill='%23cbd5e1'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23ffffff'/%3E%3Cpath d='M18 88C18 70.327 32.327 56 50 56C67.673 56 82 70.327 82 88H18Z' fill='%23ffffff'/%3E%3C/svg%3E";



export function normalizeDish(raw: any): Recipe {
  if (!raw) {
    throw new Error('Dish data is null or undefined');
  }

  const name = raw.name || raw.title || 'Món ăn ngon';
  const slug = raw.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const image = raw.image_url || raw.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
  const cookTime: number | null = raw.cook_time_minutes ?? raw.cookingTime ?? null;

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

  // Nutrition / Macros handling: món chưa khai dinh dưỡng thì để null (giao diện hiển thị "—")
  const num = (v: any): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const calo = num(raw.calories ?? raw.nutrition?.calories ?? raw.macros?.calories);
  const protein = num(raw.protein_g ?? raw.nutrition?.protein_g ?? raw.macros?.protein);
  const carbs = num(raw.carbs_g ?? raw.nutrition?.carbs_g ?? raw.macros?.carbs);
  const fat = num(raw.fat_g ?? raw.nutrition?.fat_g ?? raw.macros?.fat);

  const macros = {
    calories: calo,
    protein: protein,
    carbs: carbs,
    fat: fat,
  };

  // Ingredients handling
  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : (raw.dish_ingredients || []);
  const ingredients: Ingredient[] = rawIngredients.map((item: any, idx: number) => {
    const ingName = item.name || item.ingredient?.name || `Nguyên liệu ${idx + 1}`;
    const qty = num(item.quantity ?? item.amount);
    const unit = item.unit || '';
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
      isSafe: !item.is_user_allergen,
      avoidedVia: item.avoided_via || null,
    };
  });

  // Steps handling
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps: CookingStep[] = rawSteps.map((s: any, idx: number) => {
    const text = s.content || s.instruction || s.title || `Bước ${idx + 1}`;
    const duration = s.duration_minutes ?? s.durationMinutes ?? undefined;
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

  const avgRating = Number(raw.avg_rating ?? raw.rating ?? 0) || 0;
  const ratingCount = Number(raw.rating_count ?? raw.reviewCount ?? 0) || 0;
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
    est_cost: num(raw.est_cost),
    rating: avgRating,
    avg_rating: avgRating,
    reviewCount: ratingCount,
    rating_count: ratingCount,
    favorite_count: favoriteCount,
    matchPercentage: raw.match ? Math.round(raw.match.ratio * 100) : raw.matchPercentage,
    match: raw.match,
    contains_user_allergens: Boolean(raw.contains_user_allergens),
    macros: macros,
    nutrition: {
      calories: calo,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    },
    calories: calo,
    description: raw.description || '',
    tags: tags,
    ingredients: ingredients,
    steps: steps,
    utensils: raw.utensils,
    status: raw.is_published ? 'published' : (raw.status || 'published'),
    is_published: raw.is_published ?? true,
    ingredient_count: raw.ingredient_count,
    has_recipe: raw.has_recipe,
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

// Phần tử của GET /me/recommendations có dạng { dish, score, reasons }
export function normalizeRecommendation(item: any): Recipe {
  const recipe = normalizeDish(item?.dish ?? item);
  if (typeof item?.score === 'number') recipe.matchPercentage = Math.round(item.score * 100);
  if (Array.isArray(item?.reasons)) recipe.recommendReasons = item.reasons;
  return recipe;
}
