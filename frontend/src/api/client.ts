// frontend/src/api/client.ts
// Core HTTP Client connecting Frontend to CulinaAI Backend (Express + Supabase + Gemini)

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = 'API_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Compute Base API URL:
// In dev with proxy, '/api' is automatically forwarded by frontend server (port 3000) -> backend (port 5000).
// If VITE_API_URL is provided, we normalize it to ensure clean '/api' endpoint prefix.
function resolveBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (!envUrl) {
    return '/api';
  }
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
}

export const BASE_API_URL = resolveBaseUrl();

// Guest ID management (Guest 5-turn free tier)
export function getGuestId(): string {
  let gid = localStorage.getItem('culina_guest_id');
  if (!gid) {
    gid = `guest_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    localStorage.setItem('culina_guest_id', gid);
  }
  return gid;
}

// Auth token management
export function getAuthToken(): string | null {
  return localStorage.getItem('culina_token') || null;
}

export function setAuthToken(token: string, refreshToken?: string): void {
  localStorage.setItem('culina_token', token);
  if (refreshToken) {
    localStorage.setItem('culina_refresh_token', refreshToken);
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem('culina_token');
  localStorage.removeItem('culina_refresh_token');
  localStorage.removeItem('culina_user');
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

/**
 * Universal API Request Method with Bearer Token & Guest ID injection
 */
export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const guestId = getGuestId();

  // Query parameters builder
  let urlPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (options.params) {
    const qParams = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        qParams.append(k, String(v));
      }
    });
    const qs = qParams.toString();
    if (qs) {
      urlPath += `${urlPath.includes('?') ? '&' : '?'}${qs}`;
    }
  }

  const url = `${BASE_API_URL}${urlPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-guest-id': guestId,
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return null as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `Lỗi máy chủ (${response.status})`;
      const errorCode = data.error?.code || 'API_ERROR';
      const errorDetails = data.error?.details || null;
      throw new ApiError(errorMsg, errorCode, response.status, errorDetails);
    }

    return data;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or CORS errors
    console.warn(`[API Client] Không thể kết nối tới ${url}:`, err.message);
    throw new ApiError(
      'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.',
      'NETWORK_ERROR',
      0
    );
  }
}
