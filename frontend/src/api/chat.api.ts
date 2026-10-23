// frontend/src/api/chat.api.ts
// AI Culinary Chatbot API module

import { apiClient, getGuestId } from './client';
import { ChatSession, ChatMessage, GuestQuota } from '../types';

export interface SendGuestMessageResponse {
  guest_id: string;
  reply: {
    type: 'clarification' | 'out_of_scope' | 'qa' | 'recipe';
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
    try {
      const gid = getGuestId();
      const res = await apiClient<{
        success: boolean;
        data: GuestQuota;
      }>(`/chat/guest/quota?guest_id=${gid}`);
      return res.data;
    } catch {
      return {
        used: 0,
        limit: 5,
        remaining: 5,
        resets_at: new Date(Date.now() + 86400000).toISOString(),
        resets_in_seconds: 86400,
      };
    }
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

  async createSession(title?: string): Promise<ChatSession> {
    const res = await apiClient<{
      success: boolean;
      data: ChatSession;
    }>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'Hội thoại nấu ăn mới' }),
    });
    return res.data;
  },

  async getSessionDetail(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const res = await apiClient<{
      success: boolean;
      data: {
        id?: string;
        title?: string;
        created_at?: string;
        updated_at?: string;
        messages: ChatMessage[];
      };
    }>(`/chat/sessions/${sessionId}`);

    const rawData = res.data;
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
};
