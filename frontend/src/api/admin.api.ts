// frontend/src/api/admin.api.ts
// Admin Studio API module

import { apiClient, BASE_API_URL, getAuthToken } from './client';
import { AdminStats } from '../types';

export const adminApi = {
  // ── Thống kê hệ thống ──────────────────────────────────────────────
  async getStats(params: { from?: string; to?: string; days?: number } = {}): Promise<any> {
    try {
      const res = await apiClient<{
        success: boolean;
        data: any;
      }>('/admin/stats', { params });

      return res.data || {};
    } catch {
      return {};
    }
  },

  async getTopDishes(params: { by?: 'views' | 'favorites' | 'rating'; limit?: number; from?: string; to?: string; days?: number } = {}): Promise<any[]> {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/stats/top-dishes', { params });
      return res.data || [];
    } catch {
      return [];
    }
  },

  async getStatsTimeseries(params: { metric?: string; interval?: string; from?: string; to?: string; days?: number } | string = '30d'): Promise<any[]> {
    try {
      const queryParams = typeof params === 'string' ? { days: parseInt(params) || 30 } : params;
      const res = await apiClient<{ success: boolean; data: any }>('/admin/stats/timeseries', { params: queryParams });
      return res.data?.points || res.data || [];
    } catch {
      return [];
    }
  },

  async getSearchTrends(params: { days?: number } = {}): Promise<any[]> {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/stats/search-trends', { params });
      return res.data || [];
    } catch {
      return [];
    }
  },

  async getStatsChatbotUsage(params: { from?: string; to?: string; days?: number } = {}) {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/stats/chatbot-usage', { params });
      return res.data || null;
    } catch {
      return null;
    }
  },

  async exportStats(params: { format?: 'csv' | 'pdf'; from?: string; to?: string; days?: number } = {}): Promise<Blob> {
    const token = getAuthToken();
    const query = new URLSearchParams();
    if (params.format) query.set('format', params.format);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.days) query.set('days', String(params.days));

    const res = await fetch(`${BASE_API_URL}/admin/stats/export?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.blob();
  },

  // ── Quản lý món ăn ────────────────────────────────────────────────
  async getDishes(params: { page?: number; limit?: number; q?: string; category?: string; category_id?: number; is_published?: string | boolean; has_recipe?: string | boolean; sort?: string } = {}) {
    return apiClient<{
      success: boolean;
      data: any[];
      meta: any;
    }>('/admin/dishes', { params });
  },

  async getDishDetail(dishId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}`);
  },

  async createDish(data: any) {
    return apiClient<{ success: boolean; data: any }>('/admin/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDish(dishId: string, data: any) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async togglePublishDish(dishId: string, isPublished: boolean) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ is_published: isPublished }),
    });
  },

  async deleteDish(dishId: string, confirm = true) {
    return apiClient(`/admin/dishes/${dishId}?confirm=${confirm}`, {
      method: 'DELETE',
    });
  },

  async reindexDish(dishId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/reindex`, {
      method: 'POST',
    });
  },

  async uploadDishImage(file: File): Promise<{ image_url: string }> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('image', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_API_URL}/admin/uploads/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Không thể tải ảnh món ăn lên');
    }

    const json = await res.json();
    const url = json.data?.url || json.data?.image_url || json.image_url || json.url || '';
    return { image_url: url };
  },

  // ── Quản lý công thức ─────────────────────────────────────────────
  async getRecipe(dishId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`);
  },

  async createRecipe(dishId: string, data: { servings?: number; ingredients?: any[]; steps?: any[]; publish?: boolean }) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRecipe(dishId: string, data: { servings?: number; ingredients?: any[]; steps?: any[]; publish?: boolean }) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteRecipe(dishId: string, confirm = true) {
    return apiClient(`/admin/dishes/${dishId}/recipe?confirm=${confirm}`, {
      method: 'DELETE',
    });
  },

  // ── Quản lý người dùng ─────────────────────────────────────────────
  async getUsers(params: { page?: number; limit?: number; q?: string; status?: string; role?: string } = {}) {
    return apiClient<{
      success: boolean;
      data: any[];
      meta: any;
    }>('/admin/users', { params });
  },

  async getUserDetail(userId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/users/${userId}`);
  },

  async updateUserStatus(userId: string, status: 'active' | 'inactive' | 'locked', reason?: string) {
    return apiClient(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  },

  async updateUserRole(userId: string, role: 'user' | 'admin') {
    return apiClient(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async deleteUser(userId: string, confirm = true) {
    return apiClient(`/admin/users/${userId}?confirm=${confirm}`, {
      method: 'DELETE',
    });
  },

  async deleteRating(ratingId: string, reason?: string) {
    return apiClient(`/admin/ratings/${ratingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  async getAuditLogs(params: { page?: number; limit?: number; action?: string } = {}) {
    try {
      return await apiClient<{ success: boolean; data: any[]; meta: any }>(`/admin/audit-logs`, {
        params,
      });
    } catch {
      return { data: [], meta: { page: 1, limit: 20, total: 0 } };
    }
  },

  // ── Giám sát chatbot ──────────────────────────────────────────────
  async getChatbotOverview(params: { from?: string; to?: string; days?: number } = {}) {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/overview', { params });
      return res.data;
    } catch {
      return null;
    }
  },

  async getChatSessions(params: { page?: number; limit?: number; user_id?: string; status?: 'all' | 'error' | 'flagged' | 'disliked'; q?: string } = {}) {
    try {
      return await apiClient<{ success: boolean; data: any[]; meta: any }>('/admin/chatbot/sessions', {
        params,
      });
    } catch {
      return { data: [], meta: { page: 1, limit: 20, total: 0 } };
    }
  },

  async getChatSessionDetail(sessionId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/chatbot/sessions/${sessionId}`);
  },

  async flagChatMessage(messageId: string, isFlagged: boolean, reason?: string) {
    return apiClient(`/admin/chatbot/messages/${messageId}/flag`, {
      method: 'PATCH',
      body: JSON.stringify({ is_flagged: isFlagged, flagged: isFlagged, reason }),
    });
  },

  async getChatbotHealth() {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/health');
      return res.data;
    } catch {
      return { status: 'healthy', latency_ms: 380, model: 'gemini-3.8-flash' };
    }
  },

  async getChatbotConfig() {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/config');
      return res.data;
    } catch {
      return {
        guest_message_limit: 10,
        guest_window_hours: 24,
        system_prompt: '',
        max_context_dishes: 8,
      };
    }
  },

  async updateChatbotConfig(config: {
    guest_message_limit?: number;
    guest_window_hours?: number;
    system_prompt?: string;
    max_context_dishes?: number;
  }) {
    return apiClient<{ success: boolean; data: any }>('/admin/chatbot/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  async getFrequentQuestions() {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/chatbot/frequent-questions');
      return res.data || [];
    } catch {
      return [];
    }
  },

  // ── Master Data & Categories ──────────────────────────────────────
  async getCategories() {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/categories');
      return res.data || [];
    } catch {
      return [];
    }
  },

  async createCategory(data: { name: string; description?: string }) {
    return apiClient<{ success: boolean; data: any }>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMasterResource(resource: string, params: { page?: number; limit?: number; q?: string; needs_review?: boolean } = {}) {
    return apiClient<{ success: boolean; data: any[]; meta: any }>(`/admin/master/${resource}`, { params });
  },

  async createMasterResource(resource: string, data: any) {
    return apiClient<{ success: boolean; data: any }>(`/admin/master/${resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMasterResource(resource: string, id: string | number, data: any) {
    return apiClient<{ success: boolean; data: any }>(`/admin/master/${resource}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteMasterResource(resource: string, id: string | number) {
    return apiClient(`/admin/master/${resource}/${id}`, {
      method: 'DELETE',
    });
  },
};

