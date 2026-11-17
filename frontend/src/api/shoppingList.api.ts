// frontend/src/api/shoppingList.api.ts
// Danh sách đi chợ (UC17) – mục 4.15 của tài liệu API

import { apiClient } from './client';
import { ShoppingList, ShoppingListItem, ShoppingListSummary } from '../types';

type Ok<T> = { success: boolean; data: T };

export const shoppingListApi = {
  /** 4.15.1 */
  async get(): Promise<ShoppingList> {
    const res = await apiClient<Ok<ShoppingList>>('/me/shopping-list');
    return res.data;
  },

  /**
   * 4.15.2 – món đã có mà không gửi onExisting thì ném ApiError SHOPPING_DISH_EXISTS
   * (error.details.current_servings) để giao diện hỏi cộng thêm hay thay thế.
   */
  async addDish(dishId: string, servings?: number, onExisting?: 'add' | 'replace') {
    const res = await apiClient<Ok<{ dish: { dish_id: string; name: string; servings: number }; summary: Pick<ShoppingListSummary, 'dish_count' | 'to_buy'> }>>(
      '/me/shopping-list/dishes',
      { method: 'POST', body: JSON.stringify({ dish_id: dishId, servings, ...(onExisting ? { on_existing: onExisting } : {}) }) }
    );
    return res.data;
  },

  /** 4.15.3 */
  async updateDishServings(dishId: string, servings: number): Promise<ShoppingList> {
    const res = await apiClient<Ok<ShoppingList>>(`/me/shopping-list/dishes/${dishId}`, {
      method: 'PATCH',
      body: JSON.stringify({ servings }),
    });
    return res.data;
  },

  /** 4.15.4 */
  async removeDish(dishId: string): Promise<ShoppingList> {
    const res = await apiClient<Ok<ShoppingList>>(`/me/shopping-list/dishes/${dishId}`, { method: 'DELETE' });
    return res.data;
  },

  /** 4.15.5 */
  async addItem(input: { name: string; quantity?: number | null; unit?: string | null }) {
    const res = await apiClient<Ok<{ item: ShoppingListItem; summary: ShoppingListSummary }>>('/me/shopping-list/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /** 4.15.6 */
  async updateItem(
    itemId: number,
    patch: Partial<Pick<ShoppingListItem, 'have_at_home' | 'purchased' | 'name' | 'quantity' | 'unit'>>
  ) {
    const res = await apiClient<Ok<{ item: ShoppingListItem; summary: ShoppingListSummary }>>(`/me/shopping-list/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return res.data;
  },

  /** 4.15.7 */
  async deleteItem(itemId: number) {
    const res = await apiClient<Ok<{ id: number; deleted: boolean; summary: ShoppingListSummary }>>(`/me/shopping-list/items/${itemId}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  /** 4.15.8 */
  async clear(): Promise<ShoppingList> {
    const res = await apiClient<Ok<ShoppingList>>('/me/shopping-list', { method: 'DELETE', params: { confirm: true } });
    return res.data;
  },
};
