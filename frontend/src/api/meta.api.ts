// frontend/src/api/meta.api.ts
// Metadata filters & categories API module

import { apiClient } from './client';
import { MetaFilters } from '../types';

export const metaApi = {
  async getFilters(): Promise<MetaFilters> {
    try {
      const res = await apiClient<{
        success: boolean;
        data: MetaFilters;
      }>('/meta/filters');
      return res.data;
    } catch (err) {
      console.warn('Fallback meta filters:', err);
      return {
        categories: [
          { id: 1, name: 'Món nước', slug: 'mon-nuoc' },
          { id: 2, name: 'Món xào', slug: 'mon-xao' },
          { id: 3, name: 'Món kho', slug: 'mon-kho' },
          { id: 4, name: 'Món canh', slug: 'mon-canh' },
          { id: 5, name: 'Món nướng / chiên', slug: 'mon-nuong-chien' },
          { id: 6, name: 'Món gỏi / nộm', slug: 'mon-goi-nom' },
          { id: 7, name: 'Món tráng miệng', slug: 'mon-trang-mieng' },
        ],
        tags: [
          { id: 1, name: 'Cay' },
          { id: 2, name: 'Chua ngọt' },
          { id: 3, name: 'Thanh đạm' },
          { id: 4, name: 'Bổ dưỡng' },
          { id: 5, name: 'Nhanh gọn' },
          { id: 6, name: 'Tiết kiệm' },
          { id: 7, name: 'Dễ làm' },
          { id: 8, name: 'Đặc sản' },
        ],
        diet_types: [
          { id: 1, code: 'normal', name: 'Bình thường' },
          { id: 2, code: 'eat_clean', name: 'Eat Clean' },
          { id: 3, code: 'vegetarian', name: 'Ăn chay' },
          { id: 4, code: 'vegan', name: 'Thuần chay' },
          { id: 5, code: 'keto', name: 'Keto / Low-Carb' },
          { id: 6, code: 'high_protein', name: 'Tăng cơ (High Protein)' },
        ],
        allergen_groups: [
          { id: 1, code: 'seafood', name: 'Hải sản có vỏ' },
          { id: 2, code: 'peanut', name: 'Đậu phộng' },
          { id: 3, code: 'dairy', name: 'Sữa bò / Lactose' },
          { id: 4, code: 'gluten', name: 'Gluten' },
          { id: 5, code: 'egg', name: 'Trứng' },
          { id: 6, code: 'soy', name: 'Đậu nành' },
        ],
      };
    }
  },
};
