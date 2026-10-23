// frontend/src/api/dishes.api.ts
// Dishes, Recipes, Recommendations, and Engagement API module

import { apiClient, getAuthToken } from './client';
import { Recipe } from '../types';
import { normalizeDish } from '../utils/dishUtils';

export interface GetDishesParams {
  q?: string;
  region_id?: number;
  category_id?: number;
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
  sort?: 'relevance' | 'match' | 'newest' | 'rating' | 'popular' | 'cook_time' | 'calories';
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

  async getRecommendations(): Promise<Recipe[]> {
    try {
      const token = getAuthToken();
      const endpoint = token ? '/me/recommendations' : '/dishes/recommendations';
      const res = await apiClient<{ success: boolean; data: any[] }>(endpoint);
      return (res.data || []).map(normalizeDish);
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

  async getRatings(dishId: string, params: { page?: number; limit?: number; sort?: string } = {}) {
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
          comment: string;
          user: {
            id: string | null;
            name: string;
            avatar?: string;
          };
          created_at: string;
        }>;
      };
      meta?: any;
    }>(`/dishes/${dishId}/ratings`, { params });
  },

  async createRating(dishId: string, stars: number, comment?: string) {
    return apiClient<{
      success: boolean;
      data: any;
    }>(`/dishes/${dishId}/ratings`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment }),
    });
  },

  async updateRating(ratingId: number | string, stars: number, comment?: string) {
    return apiClient(`/ratings/${ratingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stars, comment }),
    });
  },

  async deleteRating(ratingId: number | string) {
    return apiClient(`/ratings/${ratingId}`, {
      method: 'DELETE',
    });
  },
};

