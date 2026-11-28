// frontend/src/api/index.ts
// Unified API Gateway connecting ChefAI Frontend to Backend Services

import { authApi } from './auth.api';
import { dishesApi } from './dishes.api';
import { chatApi } from './chat.api';
import { tasteProfileApi } from './tasteProfile.api';
import { ingredientsApi } from './ingredients.api';
import { metaApi } from './meta.api';
import { adminApi } from './admin.api';
import { apiClient, BASE_API_URL, ApiError } from './client';

// Health check endpoint
async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_API_URL}/health`);
    const json = await res.json();
    return json.status === 'ok';
  } catch {
    return false;
  }
}

// Unified API service object
export const api = {
  client: apiClient,
  checkHealth,
  auth: authApi,
  dishes: dishesApi,
  chat: chatApi,
  me: tasteProfileApi,
  tasteProfile: tasteProfileApi,
  ingredients: ingredientsApi,
  meta: metaApi,
  admin: adminApi,
};

// Aliases for compatibility
export const apiService = api;
export default api;

// Direct named exports for modular tree-shaking
export * from './client';
export * from './auth.api';
export * from './dishes.api';
export * from './chat.api';
export * from './tasteProfile.api';
export * from './ingredients.api';
export * from './meta.api';
export * from './admin.api';
