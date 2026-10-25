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
  // Nội bộ: đã thử làm mới mã truy cập cho yêu cầu này hay chưa
  _retried?: boolean;
}

// Dùng chung một yêu cầu làm mới khi nhiều API cùng nhận TOKEN_EXPIRED
let refreshPromise: Promise<string | null> | null = null;

/**
 * Làm mới mã truy cập bằng refresh token (POST /auth/refresh). Mã làm mới được cấp mới mỗi lần nên lưu lại cả hai.
 */
export function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('culina_refresh_token');
  if (!refreshToken) return Promise.resolve(null);
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        const token = json.data?.access_token;
        if (!res.ok || !token) {
          clearAuthToken();
          return null;
        }
        setAuthToken(token, json.data?.refresh_token);
        return token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Ghép thông báo lỗi: ưu tiên lỗi theo từng trường (error.details) nếu có. */
function buildErrorMessage(data: any, status: number): string {
  const details = data?.error?.details;
  if (Array.isArray(details)) {
    const messages = details.map((d: any) => d?.message).filter(Boolean);
    if (messages.length > 0) return [...new Set(messages)].join(' ');
  }
  return data?.error?.message || data?.message || `Lỗi máy chủ (${status})`;
}

/**
 * fetch kèm mã truy cập cho các yêu cầu không gửi JSON (tải tệp lên, tải tệp về).
 * Tự làm mới mã truy cập một lần khi nhận TOKEN_EXPIRED; lỗi được ném ra dưới dạng ApiError.
 */
export async function authFetch(endpoint: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_API_URL}${endpoint}`, { ...init, headers });
  } catch {
    throw new ApiError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.', 'NETWORK_ERROR', 0);
  }
  if (res.ok) return res;

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data?.error?.code === 'TOKEN_EXPIRED' && !retried && (await refreshAccessToken())) {
    return authFetch(endpoint, init, true);
  }
  throw new ApiError(buildErrorMessage(data, res.status), data?.error?.code || 'API_ERROR', res.status, data?.error?.details || null);
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

  const { params: _params, _retried, ...fetchOptions } = options;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // 204 (xóa) và 202 (ghi nhận tương tác) có thể không có nội dung
    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorCode = data?.error?.code || 'API_ERROR';
      // Mã truy cập hết hạn: làm mới rồi gửi lại đúng một lần
      if (response.status === 401 && errorCode === 'TOKEN_EXPIRED' && !_retried && (await refreshAccessToken())) {
        return apiClient<T>(endpoint, { ...options, _retried: true });
      }
      throw new ApiError(buildErrorMessage(data, response.status), errorCode, response.status, data?.error?.details || null);
    }

    return data as T;
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
