// frontend/src/api/mealPlan.api.ts
// Gợi ý thực đơn tuần (UC17) – mục 4.15 của tài liệu API

import { apiClient } from './client';
import { MealKey, MealPlan } from '../types';

type Ok<T> = { success: boolean; data: T };

export const mealPlanApi = {
  /** 4.15.1 */
  async get(): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>('/me/meal-plan')).data;
  },

  /** 4.15.2 – ghi đè thực đơn hiện tại */
  async generate(week: 'current' | 'next' = 'current'): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>('/me/meal-plan/generate', { method: 'POST', body: JSON.stringify({ week }) })).data;
  },

  /** 4.15.3 */
  async regenerateMeal(dayIndex: number, meal: MealKey): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>(`/me/meal-plan/days/${dayIndex}/meals/${meal}/regenerate`, { method: 'POST' })).data;
  },

  /** 4.15.4 */
  async swapItem(itemId: number): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>(`/me/meal-plan/items/${itemId}/swap`, { method: 'POST' })).data;
  },

  /** 4.15.5 */
  async removeItem(itemId: number): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>(`/me/meal-plan/items/${itemId}`, { method: 'DELETE' })).data;
  },

  /** 4.15.6 */
  async clear(): Promise<MealPlan> {
    return (await apiClient<Ok<MealPlan>>('/me/meal-plan', { method: 'DELETE', params: { confirm: true } })).data;
  },
};
