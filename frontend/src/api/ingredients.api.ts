// frontend/src/api/ingredients.api.ts
// Ingredients search & master data API module

import { apiClient } from './client';

export interface IngredientItem {
  id: number;
  name: string;
  slug?: string;
  category?: string;
  is_common?: boolean;
}

export const ingredientsApi = {
  async getIngredients(params: {
    q?: string;
    is_common?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    return apiClient<{
      success: boolean;
      data: IngredientItem[];
      meta?: any;
    }>('/ingredients', { params });
  },

  async getCommonIngredients() {
    return this.getIngredients({ is_common: true, limit: 50 });
  },
};
