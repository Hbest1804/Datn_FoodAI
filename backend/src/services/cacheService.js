// src/services/cacheService.js
// Bộ nhớ đệm trong tiến trình cho dữ liệu đọc nhiều, ít đổi (danh sách món công khai, nguyên liệu, bộ lọc, phiên đăng nhập).
// Mỗi truy vấn tới Supabase mất vài trăm ms nên đọc lại từ bộ nhớ nhanh hơn nhiều; khi Admin ghi dữ liệu thì xóa đệm.

import { supabaseAdmin } from '../config/supabase.js';

const store = new Map();

/**
 * Trả về giá trị đệm của `key`, hết hạn sau `ttlMs`; nếu chưa có thì gọi `loader`.
 * Lưu cả Promise nên nhiều yêu cầu đồng thời chỉ tạo một truy vấn; lỗi thì không lưu.
 * `stale: true`: khi hết hạn vẫn trả bản cũ ngay và tải lại ở nền, người dùng không phải chờ CSDL
 * (chỉ dùng cho dữ liệu danh mục, không dùng cho phiên đăng nhập).
 */
export function cached(key, ttlMs, loader, { stale = false } = {}) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  if (stale && hit?.ready) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      Promise.resolve().then(loader)
        .then((value) => {
          if (store.get(key) === hit) store.set(key, { promise: Promise.resolve(value), expiresAt: Date.now() + ttlMs, ready: true });
        })
        .catch((err) => {
          hit.refreshing = false;
          console.warn(`[Cache] Không làm mới được ${key}:`, err.message);
        });
    }
    return hit.promise;
  }
  const entry = { promise: Promise.resolve().then(loader), expiresAt: Date.now() + ttlMs, ready: false };
  store.set(key, entry);
  entry.promise.then(() => { entry.ready = true; }, () => {
    if (store.get(key) === entry) store.delete(key);
  });
  return entry.promise;
}

/** Xóa các khóa bắt đầu bằng `prefix` (bỏ trống = xóa hết). */
export function invalidateCache(prefix = '') {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// ── Dữ liệu danh mục dùng chung ──────────────────────────────────────────────

const CATALOG_TTL_MS = 60 * 1000;

// Gộp đủ trường cho danh sách món, món phổ biến và gợi ý để chỉ cần một truy vấn
const PUBLISHED_DISH_FIELDS = `id, name, slug, description, image_url, category, category_normalized, cook_time_minutes, difficulty,
  calories, protein_g, carbs_g, fat_g, servings, est_cost, avg_rating, rating_count, favorite_count, created_at, updated_at,
  dish_tags(tag_id),
  dish_ingredients(ingredient_id, is_optional, ingredient:ingredients(id, name, aliases))`;

/** Toàn bộ món đang hiển thị kèm thẻ và nguyên liệu (đệm 60 giây). Không sửa trực tiếp các phần tử trả về. */
export function getPublishedDishes() {
  return cached('catalog:dishes', CATALOG_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin.from('dishes').select(PUBLISHED_DISH_FIELDS).eq('is_published', true);
    if (error) throw error;
    return data || [];
  }, { stale: true });
}

/** id, tên và nhóm dị ứng của mọi nguyên liệu (đệm 60 giây). */
export function getIngredientIndex() {
  return cached('catalog:ingredients', CATALOG_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin.from('ingredients').select('id, name, allergen_group_id');
    if (error) throw error;
    return data || [];
  }, { stale: true });
}

/** Nguyên liệu gốc → danh sách id nguyên liệu con trực tiếp, từ bảng ingredient_parents (đệm 60 giây). */
export function getIngredientChildren() {
  return cached('catalog:ingredient_children', CATALOG_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin.from('ingredient_parents').select('ingredient_id, parent_id');
    const children = new Map();
    if (error) {
      // Chưa có bảng: vẫn lọc theo nguyên liệu kiêng trực tiếp, chỉ không mở rộng theo nhóm
      console.warn('[Cache] Không đọc được ingredient_parents:', error.message);
      return children;
    }
    for (const { ingredient_id: id, parent_id: pid } of data || []) {
      if (!children.has(Number(pid))) children.set(Number(pid), []);
      children.get(Number(pid)).push(Number(id));
    }
    return children;
  }, { stale: true });
}

/** Xóa đệm danh mục khi món, nguyên liệu hoặc lượt yêu thích/đánh giá thay đổi. */
export function invalidateCatalog() {
  invalidateCache('catalog:');
}
