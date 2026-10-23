// frontend/src/api/admin.api.ts
// Admin Studio API module

import { apiClient, authFetch } from './client';

type RangeParams = { from?: string; to?: string; days?: number };

export interface RecipePayload {
  ingredients: Array<{
    ingredient_id?: number;
    name?: string;
    quantity: number;
    unit?: string;
    allergen_group_id?: number | null;
    no_allergen?: boolean;
  }>;
  steps: Array<{ order: number; content: string }>;
  publish?: boolean;
}

export interface DishImportResult {
  dry_run: boolean;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  created_count: number;
  errors: Array<{ row: number; field: string; code: string; message: string }>;
  warnings: string[];
  created?: Array<{ row: number; id: string; name: string; slug: string }>;
}

// Tài liệu API dùng from/to (YYYY-MM-DD); quy đổi tham số days của giao diện sang khoảng ngày
function toRange<T extends RangeParams>(params: T): Omit<T, 'days'> {
  const { days, ...rest } = params;
  if (!days || rest.from || rest.to) return rest;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { ...rest, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const adminApi = {
  // ── Thống kê hệ thống ──────────────────────────────────────────────
  async getStats(params: { from?: string; to?: string; days?: number } = {}): Promise<any> {
    try {
      const res = await apiClient<{
        success: boolean;
        data: any;
      }>('/admin/stats/overview', { params: toRange(params) });

      return res.data || {};
    } catch {
      return {};
    }
  },

  async getTopDishes(params: { by?: 'views' | 'favorites' | 'rating'; limit?: number; from?: string; to?: string; days?: number } = {}): Promise<any[]> {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/stats/top-dishes', { params: toRange(params) });
      return res.data || [];
    } catch {
      return [];
    }
  },

  async getStatsTimeseries(params: { metric?: string; interval?: string; from?: string; to?: string; days?: number } | string = '30d'): Promise<any[]> {
    try {
      const queryParams = toRange(typeof params === 'string' ? { metric: 'visits', days: parseInt(params) || 30 } : { metric: 'visits', ...params });
      const res = await apiClient<{ success: boolean; data: any }>('/admin/stats/timeseries', { params: queryParams });
      return res.data?.points || res.data || [];
    } catch {
      return [];
    }
  },

  async getSearchTrends(params: { days?: number } = {}): Promise<any[]> {
    try {
      const res = await apiClient<{ success: boolean; data: any[] }>('/admin/stats/search-trends', { params: toRange(params) });
      return res.data || [];
    } catch {
      return [];
    }
  },

  async getStatsChatbotUsage(params: { from?: string; to?: string; days?: number } = {}) {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/stats/chatbot-usage', { params: toRange(params) });
      return res.data || null;
    } catch {
      return null;
    }
  },

  async exportStats(params: { type?: 'overview' | 'top-dishes' | 'search-trends' | 'chatbot-usage'; format?: 'xlsx' | 'csv' | 'pdf'; from?: string; to?: string; days?: number } = {}): Promise<Blob> {
    const range = toRange(params);
    const query = new URLSearchParams();
    query.set('type', params.type || 'overview');
    query.set('format', params.format || 'xlsx');
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);

    const res = await authFetch(`/admin/stats/export?${query.toString()}`);
    return res.blob();
  },

  // ── Quản lý món ăn ────────────────────────────────────────────────
  async getDishes(params: { page?: number; limit?: number; q?: string; category?: string; is_published?: boolean; sort?: 'updated_at' | 'created_at' | 'name' } = {}) {
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

  // Ảnh JPG/PNG/WEBP tối đa 5 MB, gửi trong trường "file"
  async uploadDishImage(file: File): Promise<{ image_url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await authFetch('/admin/uploads/images', { method: 'POST', body: formData });
    const json = await res.json();
    return { image_url: json.data?.url || '' };
  },

  // ── Nhập món từ Excel/CSV ─────────────────────────────────────────
  async downloadImportTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    const res = await authFetch(`/admin/dishes/import/template?format=${format}`);
    return res.blob();
  },

  // dry_run = true: chỉ kiểm tra file, chưa ghi dữ liệu
  async importDishes(file: File, dryRun = true): Promise<DishImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dry_run', String(dryRun));

    const res = await authFetch('/admin/dishes/import', { method: 'POST', body: formData });
    const json = await res.json();
    return json.data;
  },

  // ── Quản lý công thức ─────────────────────────────────────────────
  async getRecipe(dishId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`);
  },

  // ingredients: [{ ingredient_id | name, quantity, unit, allergen_group_id?, no_allergen? }]
  // steps: [{ order, content }]
  async createRecipe(dishId: string, data: RecipePayload) {
    return apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Lưu công thức: sửa (PUT) nếu món đã có công thức, chưa có thì tạo mới (POST)
  async updateRecipe(dishId: string, data: RecipePayload) {
    try {
      return await apiClient<{ success: boolean; data: any }>(`/admin/dishes/${dishId}/recipe`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      if (err?.code !== 'RECIPE_NOT_FOUND') throw err;
      return adminApi.createRecipe(dishId, data);
    }
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

  // Khóa tài khoản (locked) bắt buộc có lý do
  async updateUserStatus(userId: string, status: 'active' | 'locked', reason?: string) {
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

  async getAuditLogs(params: { page?: number; limit?: number; action?: string; actor_id?: string; from?: string; to?: string; days?: number } = {}) {
    try {
      return await apiClient<{ success: boolean; data: any[]; meta: any }>(`/admin/audit-logs`, {
        params: toRange(params),
      });
    } catch {
      return { data: [], meta: { page: 1, limit: 20, total: 0 } };
    }
  },

  // ── Giám sát chatbot ──────────────────────────────────────────────
  async getChatbotOverview(params: { from?: string; to?: string; days?: number } = {}) {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/overview', { params: toRange(params) });
      return res.data;
    } catch {
      return null;
    }
  },

  async getChatSessions(params: { page?: number; limit?: number; user_id?: string; status?: 'all' | 'error' | 'flagged' | 'disliked'; q?: string; from?: string; to?: string; days?: number } = {}) {
    try {
      return await apiClient<{ success: boolean; data: any[]; meta: any }>('/admin/chatbot/conversations', {
        params: toRange(params),
      });
    } catch {
      return { data: [], meta: { page: 1, limit: 20, total: 0 } };
    }
  },

  async getChatSessionDetail(sessionId: string) {
    return apiClient<{ success: boolean; data: any }>(`/admin/chatbot/conversations/${sessionId}`);
  },

  async flagChatMessage(messageId: string, isFlagged: boolean, reason?: string) {
    return apiClient(`/admin/chatbot/messages/${messageId}/flag`, {
      method: 'PATCH',
      body: JSON.stringify({ flagged: isFlagged, reason }),
    });
  },

  async getChatbotHealth() {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/health');
      return res.data;
    } catch {
      return { status: 'down', latency_ms: null, model: null };
    }
  },

  async getChatbotConfig() {
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/admin/chatbot/settings');
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
    return apiClient<{ success: boolean; data: any }>('/admin/chatbot/settings', {
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
};

