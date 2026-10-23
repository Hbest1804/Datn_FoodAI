// frontend/src/api/auth.api.ts
// Authentication API module

import { apiClient, setAuthToken, clearAuthToken, getAuthToken } from './client';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  display_name?: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  status?: 'active' | 'inactive' | 'locked';
}

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
  phone?: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
  confirm_password: string;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const res = await apiClient<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const accessToken = res.accessToken || res.data?.access_token || res.token;
    const refreshToken = res.refreshToken || res.data?.refresh_token;
    const user = res.user || res.data?.user;

    if (accessToken) {
      setAuthToken(accessToken, refreshToken);
      if (user) {
        localStorage.setItem('culina_user', JSON.stringify(user));
      }
    }

    return {
      accessToken,
      refreshToken,
      user,
    };
  },

  async register(data: RegisterData): Promise<LoginResult> {
    const res = await apiClient<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const accessToken = res.accessToken || res.data?.access_token || res.token;
    const refreshToken = res.refreshToken || res.data?.refresh_token;
    const user = res.user || res.data?.user;

    if (accessToken) {
      setAuthToken(accessToken, refreshToken);
      if (user) {
        localStorage.setItem('culina_user', JSON.stringify(user));
      }
    }

    return {
      accessToken,
      refreshToken,
      user,
    };
  },

  async getMe(): Promise<{ user: AuthUser }> {
    const res = await apiClient<any>('/auth/me');
    const user = res.user || res.data?.user || res.data;
    return { user };
  },

  async logout(): Promise<void> {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('culina_refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await apiClient<any>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      const token = res.accessToken || res.data?.access_token;
      if (token) {
        setAuthToken(token);
      }
      return token || null;
    } catch {
      clearAuthToken();
      return null;
    }
  },

  // ── Quên mật khẩu & Khôi phục mật khẩu ─────────────────────────────
  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await apiClient<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return {
      message: res.data?.message || res.message || 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
    };
  },

  async verifyResetToken(token: string): Promise<{ valid: boolean; expires_at?: string }> {
    const res = await apiClient<any>('/auth/reset-password/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return {
      valid: res.data?.valid ?? true,
      expires_at: res.data?.expires_at,
    };
  },

  async resetPassword(data: ResetPasswordData): Promise<{ message: string }> {
    const res = await apiClient<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      message: res.data?.message || res.message || 'Đặt lại mật khẩu thành công.',
    };
  },

  isAuthenticated(): boolean {
    return !!getAuthToken();
  },
};
