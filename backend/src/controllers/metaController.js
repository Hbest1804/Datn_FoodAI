// src/controllers/metaController.js
// 4.2.1 Lấy toàn bộ danh mục bộ lọc – GET /meta/filters

import { supabaseAdmin } from '../config/supabase.js';
import { sendOk } from '../utils/http.js';

/**
 * categories là danh sách tên danh mục khác nhau lấy từ các món đang hiển thị (sắp theo tên);
 * khi Admin gọi thì gồm cả danh mục của món đang ẩn (gợi ý khi nhập danh mục lúc thêm/sửa món).
 */
export async function getFilters(req, res) {
  let dishQuery = supabaseAdmin.from('dishes').select('category, category_normalized');
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin) dishQuery = dishQuery.eq('is_published', true);

  const [dishesRes, tagsRes, dietsRes, allergensRes] = await Promise.all([
    dishQuery,
    supabaseAdmin.from('tags').select('id, name').order('name'),
    supabaseAdmin.from('diet_types').select('id, code, name').order('id'),
    supabaseAdmin.from('allergen_groups').select('id, code, name').order('id'),
  ]);
  for (const r of [dishesRes, tagsRes, dietsRes, allergensRes]) if (r.error) throw r.error;

  // Gom theo category_normalized để các cách viết khác nhau của cùng danh mục chỉ xuất hiện một lần
  const byKey = new Map();
  for (const d of dishesRes.data || []) {
    if (d.category && !byKey.has(d.category_normalized)) byKey.set(d.category_normalized, d.category);
  }
  const categories = [...byKey.values()].sort((a, b) => a.localeCompare(b, 'vi'));

  res.set('Cache-Control', isAdmin ? 'private, max-age=300' : 'max-age=300');
  return sendOk(res, {
    categories,
    tags: tagsRes.data || [],
    diet_types: dietsRes.data || [],
    allergen_groups: allergensRes.data || [],
  });
}
