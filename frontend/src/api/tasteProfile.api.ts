// frontend/src/api/tasteProfile.api.ts
// Taste Profile & User Personalization API module

import { apiClient, authFetch } from './client';
import { BackendTasteProfile, Recipe } from '../types';
import { normalizeDish } from '../utils/dishUtils';

export interface UpdateTasteProfilePayload {
  preferred_region_id?: number | null;
  taste_prefs?: {
    spicy_level?: number;
    salty_level?: number;
    sweet_level?: number;
    sour_level?: number;
    liked_ingredient_ids?: number[];
  };
  // Fallbacks if flat
  spicy_level?: number;
  salty_level?: number;
  sweet_level?: number;
  sour_level?: number;
  liked_ingredient_ids?: number[];
  calorie_goal?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  household_size?: number;
  diet_type_ids?: number[];
  allergen_group_ids?: number[];
  disliked_ingredient_ids?: number[];
}

export const tasteProfileApi = {
  // ── Hồ sơ khẩu vị ──────────────────────────────────────────────────
  async getTasteProfile(): Promise<BackendTasteProfile> {
    const res = await apiClient<{
      success: boolean;
      data: BackendTasteProfile;
    }>('/me/taste-profile');
    return res.data;
  },

  async updateTasteProfile(data: UpdateTasteProfilePayload | BackendTasteProfile): Promise<BackendTasteProfile> {
    const taste_prefs = (data as any).taste_prefs || {
      spicy_level: (data as any).spicy_level ?? 0,
      salty_level: (data as any).salty_level ?? 2,
      sweet_level: (data as any).sweet_level ?? 1,
      sour_level: (data as any).sour_level ?? 1,
      liked_ingredient_ids: (data as any).liked_ingredient_ids ?? [],
    };

    const payload = {
      taste_prefs: {
        spicy_level: taste_prefs.spicy_level ?? 0,
        salty_level: taste_prefs.salty_level ?? 0,
        sweet_level: taste_prefs.sweet_level ?? 0,
        sour_level: taste_prefs.sour_level ?? 0,
        liked_ingredient_ids: taste_prefs.liked_ingredient_ids ?? [],
      },
      calorie_goal: data.calorie_goal ?? null,
      budget_min: data.budget_min ?? null,
      budget_max: data.budget_max ?? null,
      household_size: data.household_size ?? 1,
      diet_type_ids: data.diet_type_ids ?? [],
      allergen_group_ids: data.allergen_group_ids ?? [],
      disliked_ingredient_ids: data.disliked_ingredient_ids ?? [],
    };

    const res = await apiClient<{
      success: boolean;
      data: BackendTasteProfile;
    }>('/me/taste-profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  // ── Gợi ý cá nhân hóa ──────────────────────────────────────────────
  async getRecommendations(): Promise<Recipe[]> {
    const res = await apiClient<{
      success: boolean;
      data: any[];
    }>('/me/recommendations');
    return (res.data || []).map(normalizeDish);
  },

  // ── Quản lý dữ liệu cá nhân ────────────────────────────────────────
  async getMyProfile(): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>('/me');
    return res.data || res;
  },

  // Máy chủ chỉ cho sửa tên hiển thị (PATCH /me)
  async updateMyProfile(data: { display_name: string }): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data || res;
  },

  async changePassword(data: { current_password?: string; old_password?: string; new_password?: string; confirm_password?: string }): Promise<{ message: string }> {
    const payload = {
      current_password: data.current_password || data.old_password,
      new_password: data.new_password,
      confirm_password: data.confirm_password,
    };
    const res = await apiClient<{ success: boolean; message?: string; data?: any }>('/me/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { message: res.message || res.data?.message || 'Đổi mật khẩu thành công.' };
  },

  // Ảnh JPG/PNG/WEBP tối đa 2 MB, gửi trong trường "file"
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await authFetch('/me/avatar', { method: 'POST', body: formData });
    const data = await res.json();
    return { avatar_url: data.data?.avatar_url };
  },

  async getFavorites(params: { q?: string; page?: number; limit?: number } = {}): Promise<Recipe[]> {
    const res = await apiClient<{
      success: boolean;
      data: any[];
    }>('/me/favorites', { params: { limit: 100, ...params } });
    return (res.data || []).map(normalizeDish);
  },

  async clearFavorites(): Promise<void> {
    await apiClient('/me/favorites?confirm=true', { method: 'DELETE' });
  },

  async getMyRatings(): Promise<any[]> {
    const res = await apiClient<{ success: boolean; data: any[] }>('/me/ratings');
    return res.data || [];
  },

  async getViewHistory(): Promise<any[]> {
    const res = await apiClient<{
      success: boolean;
      data: any[];
    }>('/me/view-history');
    return res.data || [];
  },

  async clearViewHistory(): Promise<void> {
    await apiClient('/me/view-history?confirm=true', { method: 'DELETE' });
  },

  async deleteChatHistory(): Promise<void> {
    await apiClient('/chat/sessions?confirm=true', { method: 'DELETE' });
  },

  // ── Bộ sưu tập món ăn (5.6) ────────────────────────────────────────
  async getCollections(): Promise<any[]> {
    const res = await apiClient<{ success: boolean; data: any[] }>('/me/collections');
    return res.data || [];
  },

  async getCollection(collectionId: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(`/me/collections/${collectionId}`);
    return res.data;
  },

  async createCollection(name: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>('/me/collections', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return res.data;
  },

  async renameCollection(collectionId: string, name: string): Promise<any> {
    const res = await apiClient<{ success: boolean; data: any }>(`/me/collections/${collectionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    return res.data;
  },

  async deleteCollection(collectionId: string): Promise<void> {
    await apiClient(`/me/collections/${collectionId}`, { method: 'DELETE' });
  },

  async addDishToCollection(collectionId: string, dishId: string): Promise<void> {
    await apiClient(`/me/collections/${collectionId}/dishes/${dishId}`, { method: 'PUT' });
  },

  async removeDishFromCollection(collectionId: string, dishId: string): Promise<void> {
    await apiClient(`/me/collections/${collectionId}/dishes/${dishId}`, { method: 'DELETE' });
  },

  async deleteAccount(passwordOrConfirm?: string | boolean | { password?: string; confirm?: boolean }): Promise<void> {
    let payload: { password?: string; confirm?: boolean } | undefined;
    if (typeof passwordOrConfirm === 'string') {
      payload = { password: passwordOrConfirm, confirm: true };
    } else if (typeof passwordOrConfirm === 'boolean') {
      payload = { confirm: passwordOrConfirm };
    } else if (typeof passwordOrConfirm === 'object' && passwordOrConfirm !== null) {
      payload = { confirm: true, ...passwordOrConfirm };
    }

    await apiClient('/me', {
      method: 'DELETE',
      body: payload ? JSON.stringify(payload) : undefined,
    });
  },
};
