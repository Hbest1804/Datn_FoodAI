import { supabaseAdmin } from '../config/supabase.js';

// Lấy toàn bộ danh mục bộ lọc (vùng miền, loại món, thẻ, chế độ ăn, nhóm dị ứng)
export const getFilters = async (req, res, next) => {
  try {
    // Truy vấn song song các bảng tra cứu để tối ưu tốc độ phản hồi
    const [
      { data: categories, error: errCategories },
      { data: tags, error: errTags },
      { data: diet_types, error: errDiets },
      { data: allergen_groups, error: errAllergens }
    ] = await Promise.all([
      supabaseAdmin.from('categories').select('id, name, slug').order('id', { ascending: true }),
      supabaseAdmin.from('tags').select('id, name').order('id', { ascending: true }),
      supabaseAdmin.from('diet_types').select('id, code, name').order('id', { ascending: true }),
      supabaseAdmin.from('allergen_groups').select('id, code, name').order('id', { ascending: true })
    ]);

    // Kiểm tra lỗi nếu bảng nào gặp sự cố
    if (errCategories) throw errCategories;
    if (errTags) throw errTags;
    if (errDiets) throw errDiets;
    if (errAllergens) throw errAllergens;

    // Cache-Control 5 phút theo quy chuẩn tài liệu đặc tả 4.2.1
    res.set('Cache-Control', 'max-age=300');
    res.json({
      success: true,
      data: {
        categories: categories || [],
        tags: tags || [],
        diet_types: diet_types || [],
        allergen_groups: allergen_groups || []
      }
    });
  } catch (err) {
    next(err);
  }
};
