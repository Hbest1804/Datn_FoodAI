// frontend/src/api/dishes.api.ts
// Dishes, Recipes, Recommendations, and Engagement API module

import { apiClient, getAuthToken } from './client';
import { Recipe } from '../types';
import { normalizeDish, normalizeRecommendation } from '../utils/dishUtils';

export interface GetDishesParams {
  q?: string;
  category?: string;
  ingredient_ids?: string;
  ingredient_match?: 'any' | 'all';
  min_match_ratio?: number;
  exclude_ingredient_ids?: string;
  tag_ids?: string;
  max_cook_time?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  max_calories?: number;
  min_protein_g?: number;
  max_carbs_g?: number;
  max_fat_g?: number;
  sort?: 'relevance' | 'match' | 'newest' | 'updated' | 'rating' | 'popular' | 'cook_time' | 'calories';
  page?: number;
  limit?: number;
}

export interface GetDishesResponse {
  dishes: Recipe[];
  total: number;
  totalPages: number;
  page: number;
  suggestions?: string[];
  suggestAi?: boolean;
}

export const dishesApi = {
  async getDishes(params: GetDishesParams = {}): Promise<GetDishesResponse> {
    try {
      const res = await apiClient<{
        success: boolean;
        data: any[];
        meta: {
          page: number;
          limit: number;
          total: number;
          total_pages: number;
          suggestions?: string[];
          suggest_ai?: boolean;
        };
      }>('/dishes', { params });

      const normalized = (res.data || []).map(normalizeDish);
      return {
        dishes: normalized,
        total: res.meta?.total ?? normalized.length,
        totalPages: res.meta?.total_pages ?? 1,
        page: res.meta?.page ?? 1,
        suggestions: res.meta?.suggestions || [],
        suggestAi: res.meta?.suggest_ai || false,
      };
    } catch (err) {
      console.warn('[Dishes API] Error loading dishes from backend:', err);
      return {
        dishes: [],
        total: 0,
        totalPages: 1,
        page: 1,
        suggestions: [],
        suggestAi: false,
      };
    }
  },

  async getPopular(): Promise<Recipe[]> {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/dishes/popular');
      return (res.data || []).map(normalizeDish);
    } catch {
      return [];
    }
  },

  async getRecommendations(limit = 12): Promise<Recipe[]> {
    try {
      const token = getAuthToken();
      const endpoint = token ? '/me/recommendations' : '/dishes/recommendations';
      const res = await apiClient<{ success: boolean; data: any[] }>(`${endpoint}?limit=${limit}`);
      return (res.data || []).map(normalizeRecommendation);
    } catch {
      return [];
    }
  },

  async getDetail(idOrSlug: string): Promise<Recipe> {
    const res = await apiClient<{ success: boolean; data: any }>(`/dishes/${idOrSlug}`);
    return normalizeDish(res.data);
  },

  async toggleFavorite(dishId: string, isFav: boolean) {
    if (isFav) {
      return apiClient(`/dishes/${dishId}/favorite`, { method: 'DELETE' });
    } else {
      return apiClient(`/dishes/${dishId}/favorite`, { method: 'PUT' });
    }
  },

  async getRatings(dishId: string, params: { page?: number; limit?: number; sort?: 'newest' | 'highest' | 'lowest'; has_comment?: boolean } = {}) {
    return apiClient<{
      success: boolean;
      data: {
        summary: {
          average: number;
          count: number;
          distribution: Record<string, number>;
        };
        items: Array<{
          id: number;
          stars: number;
          comment: string | null;
          user: {
            id: string | null;
            display_name: string;
            avatar_url?: string | null;
          };
          created_at: string;
          updated_at?: string;
        }>;
      };
      meta?: any;
    }>(`/dishes/${dishId}/ratings`, { params });
  },

  // Bình luận rỗng không được gửi lên (máy chủ từ chối chuỗi rỗng)
  async createRating(dishId: string, stars: number, comment?: string) {
    return apiClient<{
      success: boolean;
      data: {
        rating: { id: number; dish_id: string; stars: number; comment: string | null; created_at: string };
        rating_summary: { average: number; count: number };
      };
    }>(`/dishes/${dishId}/ratings`, {
      method: 'POST',
      body: JSON.stringify({ stars, ...(comment ? { comment } : {}) }),
    });
  },

  // comment = null để xóa bình luận, bỏ trống (undefined) để giữ nguyên
  async updateRating(ratingId: number | string, stars: number, comment?: string | null) {
    return apiClient<{
      success: boolean;
      data: { id: number; stars: number; comment: string | null; updated_at: string };
    }>(`/ratings/${ratingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stars, ...(comment !== undefined ? { comment } : {}) }),
    });
  },

  async deleteRating(ratingId: number | string) {
    return apiClient(`/ratings/${ratingId}`, {
      method: 'DELETE',
    });
  },

  // Ghi nhận tương tác (POST /interactions → 202), không chặn giao diện nên bỏ qua lỗi
  trackInteraction(
    eventType: 'view' | 'click' | 'search' | 'chat_card_click' | 'recommendation_click' | 'share' | 'page_view',
    dishId?: string,
    context?: Record<string, any>
  ): void {
    apiClient('/interactions', {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, dish_id: dishId, context }),
    }).catch(() => {});
  },
};

