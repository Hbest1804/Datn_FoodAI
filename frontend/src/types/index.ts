export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';

export interface MacroInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  fiber?: number;
}

export interface Ingredient {
  id?: string | number;
  ingredient_id?: number | string;
  name: string;
  amount?: number;
  quantity?: number;
  unit: string;
  note?: string;
  is_optional?: boolean;
  allergen?: string;
  allergen_group?: { id: number; name: string; code?: string } | null;
  isSafe?: boolean;
  substitute?: string;
}

export interface CookingStep {
  order?: number;
  stepNumber?: number;
  title?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  content?: string;
  instruction?: string;
  chefTip?: string;
  voicePrompt?: string;
  temperature?: string;
  image?: string;
}

export interface RecipeVariant {
  id: string;
  title: string;
  badge: string;
  matchScore: number;
  description: string;
  selectionRate: string;
  promptSnippet: string;
}

export interface DishMatch {
  matched_count: number;
  missing_count: number;
  ratio: number;
  missing_ingredients: Array<{ id: number; name: string }>;
}

export interface Recipe {
  id: string;
  code?: string;
  title: string;
  name?: string;
  englishTitle?: string;
  slug: string;
  image: string;
  image_url?: string;
  category: string;
  categorySlug?: string;
  region_id?: number;
  region?: string | { id: number; name: string; code?: string } | null;
  category_id?: number;
  cook_time_minutes?: number;
  cookingTime: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'Dễ' | 'Vừa' | 'Nâng cao';
  servings: number;
  est_cost?: number | null;
  rating: number;
  avg_rating?: number;
  reviewCount: number;
  rating_count?: number;
  favorite_count?: number;
  matchPercentage?: number;
  match?: DishMatch;
  macros: MacroInfo;
  nutrition?: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
  calories?: number | null;
  description: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: CookingStep[];
  utensils?: string[];
  videoUrl?: string;
  variants?: RecipeVariant[];
  status?: 'published' | 'draft' | 'needs_review' | 'macro_alert';
  is_published?: boolean;
  isPublished?: boolean;
  pricePerServing?: number;
  isAiGenerated?: boolean;
  isBookmarked?: boolean;
  is_favorite?: boolean;
  addedDate?: string;
  created_at?: string;
  updated_at?: string;
  rating_summary?: {
    average: number;
    count: number;
    distribution: Record<string, number>;
  };
  my_rating?: {
    id: number;
    stars: number;
    comment?: string;
  } | null;
  related_dishes?: Array<{
    id: string;
    name: string;
    slug: string;
    image_url?: string;
  }>;
}

export interface TasteSensoryProfile {
  spiciness: number; // 0-5
  saltiness: number; // 0-5
  sweetness: number; // 0-5
  sourness: number; // 0-5
  oiliness?: number; // 0-5
  herbAroma?: number; // 0-5
}

// GET /me/taste-profile: mức vị và household_size là null khi người dùng chưa khai báo
export interface BackendTasteProfile {
  preferred_region_id?: number | null;
  taste_prefs: {
    spicy_level: number | null;
    salty_level: number | null;
    sweet_level: number | null;
    sour_level: number | null;
    liked_ingredient_ids: number[];
  };
  calorie_goal: number | null;
  budget_min: number | null;
  budget_max: number | null;
  household_size: number | null;
  diet_type_ids: number[];
  allergen_group_ids: number[];
  disliked_ingredient_ids: number[];
  preferred_region?: { id: number; name: string } | null;
  diet_types: Array<{ id: number; name: string; code?: string }>;
  allergen_groups: Array<{ id: number; name: string; code?: string }>;
  disliked_ingredients: Array<{ id: number; name: string }>;
  completeness: number;
  updated_at?: string | null;
}

export interface MetaFilters {
  regions?: Array<{ id: number; code: string; name: string }>;
  // Tên danh mục do Admin nhập ở từng món (GET /meta/filters)
  categories: string[];
  tags: Array<{ id: number; name: string }>;
  diet_types: Array<{ id: number; code: string; name: string }>;
  allergen_groups: Array<{ id: number; code: string; name: string }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  avatar_url?: string;
  role: UserRole;
  roleLabel: string;
  isPro?: boolean;
  phone?: string;
  status?: 'active' | 'locked';
  joinedDate: string;
  lastActive: string;
  dietPreference: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  todayConsumedCalories: number;
  todayConsumedProtein: number;
  todayConsumedWaterLiters: number;
  todayTargetWaterLiters: number;
  allergiesHardLock: string[];
  intolerances: {
    lactose: boolean;
    gluten: boolean;
    autoSubstituteLactose: boolean;
  };
  sensory: TasteSensoryProfile;
  favoriteCuisines: string[];
  favoriteIngredients: string[];
  kitchenDevices: string[];
  availableCookingTime: string;
  chatQueriesCount: number;
  dailyGuestLimitLeft?: number;
  isTasteSyncedWithAi: boolean;
  tasteAccuracy: number;
  isLoggedIn?: boolean;
  spicinessLevel?: number;
  saltinessLevel?: number;
  sweetnessLevel?: number;
  sournessLevel?: number;
  householdSize?: number;
  budgetPerMeal?: number;
  allergies?: string[];
  // Backend taste profile representation
  backendTasteProfile?: BackendTasteProfile;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sender?: 'user' | 'assistant';
  role?: 'user' | 'assistant';
  timestamp?: string;
  created_at?: string;
  text?: string;
  content?: string;
  referenced_dishes?: Array<{
    id: string;
    name: string;
    slug: string;
    image_url?: string;
    description?: string;
    cook_time_minutes?: number;
    difficulty?: string;
  }>;
  identifiedIngredients?: { name: string; amount: string; category?: string }[];
  recipeRecommendation?: Recipe;
  followUpTip?: {
    title: string;
    description: string;
    methods?: { title: string; content: string }[];
  };
  quickReplies?: string[];
  feedback?: 'like' | 'dislike' | null;
  feedback_reason?: string | null;
  outcome?: string;
  tokens?: number | null;
  isFlagged?: boolean;
  flagReason?: string;
}

export interface GuestQuota {
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
  resets_in_seconds?: number;
}

export interface FridgeItem {
  id: string;
  ingredient_id?: number;
  name: string;
  amount: string;
  daysRemaining: number;
  category: 'Rau củ' | 'Thịt & Hải sản' | 'Trứng & Sữa' | 'Gia vị' | 'Khác';
  isExpiringSoon?: boolean;
}

export interface ReviewItem {
  id: string | number;
  author: string;
  location?: string;
  tag?: string;
  rating: number;
  stars?: number;
  timeAgo?: string;
  content: string;
  comment?: string;
  created_at?: string;
  images?: string[];
}

// Số liệu tổng hợp từ GET /admin/stats/overview và GET /admin/chatbot/overview
export interface AdminStats {
  chatbotInteractions: number;
  chatSessions: number;
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
  visits: number;
  dishesCount: number;
  hiddenDishesCount: number;
  aiSuccessRate: number;
  avgResponseMs: number;
  flaggedMessagesCount: number;
}
