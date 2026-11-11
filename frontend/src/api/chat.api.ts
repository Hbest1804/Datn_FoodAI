// frontend/src/api/chat.api.ts
// AI Culinary Chatbot API module

import { apiClient } from './client';
import { ChatSession, ChatMessage, GuestQuota } from '../types';

export interface SendGuestMessageResponse {
  guest_id: string;
  reply: {
    type: 'recipe' | 'general' | 'out_of_scope';
    outcome?: 'answered' | 'no_match' | 'out_of_scope';
    content: string;
    dishes: Array<{
      id: string;
      name: string;
      slug: string;
      image_url?: string;
      description?: string;
      cook_time_minutes?: number;
      difficulty?: string;
    }>;
  };
  quota: GuestQuota;
}

export interface ChatFridgeOptions {
  ingredient_ids?: number[];
  custom_ingredients?: string[];
}

export const chatApi = {
  async getGuestQuota(): Promise<GuestQuota> {
    // Khách được nhận diện qua header X-Guest-Id (apiClient tự gắn)
    const res = await apiClient<{
      success: boolean;
      data: GuestQuota;
    }>('/chat/guest/quota');
    return res.data;
  },

  async sendGuestMessage(
    message: string,
    options?: ChatFridgeOptions | { custom_ingredients?: string[]; conversation_context?: any[] }
  ): Promise<SendGuestMessageResponse> {
    const fridge: { ingredient_ids: number[]; custom_ingredients: string[] } = {
      ingredient_ids: [],
      custom_ingredients: [],
    };

    if (options) {
      if ('ingredient_ids' in options && Array.isArray(options.ingredient_ids)) {
        fridge.ingredient_ids = options.ingredient_ids;
      }
      if ('custom_ingredients' in options && Array.isArray(options.custom_ingredients)) {
        fridge.custom_ingredients = options.custom_ingredients;
      }
    }

    const res = await apiClient<{
      success: boolean;
      data: SendGuestMessageResponse;
    }>('/chat/guest/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: message,
        fridge: (fridge.ingredient_ids.length > 0 || fridge.custom_ingredients.length > 0) ? fridge : undefined,
      }),
    });
    return res.data;
  },

  async getSessions(page = 1, limit = 20) {
    return apiClient<{
      success: boolean;
      data: ChatSession[];
      meta: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>(`/chat/sessions?page=${page}&limit=${limit}`);
  },

  // Không truyền title thì máy chủ tự đặt tiêu đề theo câu hỏi đầu tiên
  async createSession(title?: string): Promise<ChatSession> {
    const res = await apiClient<{
      success: boolean;
      data: ChatSession;
    }>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    });
    return res.data;
  },

  async getSessionDetail(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    type DetailResponse = {
      success: boolean;
      data: {
        id?: string;
        title?: string;
        created_at?: string;
        updated_at?: string;
        messages: ChatMessage[];
      };
      meta?: { total_pages?: number };
    };
    // API trả tin nhắn từ cũ đến mới theo trang: tải hết các trang để hội thoại dài không mất tin mới nhất
    const fetchPage = (page: number) =>
      apiClient<DetailResponse>(`/chat/sessions/${sessionId}?page=${page}&limit=100`);

    const res = await fetchPage(1);
    const messages = [...(res.data.messages || [])];
    const totalPages = res.meta?.total_pages || 1;
    for (let page = 2; page <= totalPages; page++) {
      messages.push(...((await fetchPage(page)).data.messages || []));
    }

    const rawData = { ...res.data, messages };
    return {
      session: {
        id: rawData.id || sessionId,
        title: rawData.title || 'Hội thoại',
        created_at: rawData.created_at || new Date().toISOString(),
        updated_at: rawData.updated_at || new Date().toISOString(),
      },
      messages: rawData.messages || [],
    };
  },

  async sendMessage(
    sessionId: string,
    message: string,
    options?: ChatFridgeOptions
  ): Promise<{
    session_title?: string;
    user_message: ChatMessage;
    assistant_message: ChatMessage;
    saved?: boolean;
    warning?: string;
  }> {
    const fridge: { ingredient_ids: number[]; custom_ingredients: string[] } = {
      ingredient_ids: [],
      custom_ingredients: [],
    };

    if (options) {
      if (options.ingredient_ids) fridge.ingredient_ids = options.ingredient_ids;
      if (options.custom_ingredients) fridge.custom_ingredients = options.custom_ingredients;
    }

    const res = await apiClient<{
      success: boolean;
      data: {
        session_title?: string;
        user_message: ChatMessage;
        assistant_message: ChatMessage;
        saved?: boolean;
        warning?: string;
      };
    }>(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: message,
        fridge: (fridge.ingredient_ids.length > 0 || fridge.custom_ingredients.length > 0) ? fridge : undefined,
      }),
    });
    return res.data;
  },

  async sendFeedback(
    messageId: string,
    feedback: 'like' | 'dislike',
    reason?: string
  ) {
    return apiClient(`/chat/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback, reason }),
    });
  },

  async renameSession(sessionId: string, title: string) {
    return apiClient<{ success: boolean; data: any }>(`/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async deleteSession(sessionId: string) {
    return apiClient(`/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async deleteAllSessions(): Promise<{ deleted_sessions: number }> {
    const res = await apiClient<{ success: boolean; data: { deleted_sessions: number } }>('/chat/sessions?confirm=true', {
      method: 'DELETE',
    });
    return res.data;
  },
};
