import { supabaseAdmin } from '../config/supabase.js';
import { sanitizeSearchKeyword } from '../utils/validators.js';

/**
 * 4.2.2 Tìm nguyên liệu (autocomplete & lấy nguyên liệu phổ biến cho tủ lạnh)
 * GET /api/ingredients hoặc /ingredients
 *
 * Query params:
 *  - q: string (từ khóa tìm kiếm theo tên hoặc bí danh)
 *  - is_common: boolean ('true' để lấy nguyên liệu phổ biến cho tủ lạnh thông minh)
 *  - page: number (trang hiện tại, mặc định 1)
 *  - limit: number (số lượng bản ghi, mặc định 20, tối đa 100)
 */
export const getIngredients = async (req, res, next) => {
  try {
    const { q, is_common, page = 1, limit = 20 } = req.query;

    // Chuẩn hóa và giới hạn phân trang: limit tối đa 100 theo đặc tả
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    // Làm sạch từ khóa để ngăn chặn PostgREST filter injection (ký tự , ( ) . % " ' { } :)
    const keyword = sanitizeSearchKeyword(q);
    const filterCommon = is_common === 'true' || is_common === true;

    // Chuỗi select chuẩn theo tài liệu (bao gồm id, name của allergen_group)
    const selectWithCommon = `
      id,
      name,
      default_unit,
      is_common,
      allergen_group:allergen_groups(id, name)
    `;

    // 1. Thử truy vấn có trường is_common trước
    let query = supabaseAdmin
      .from('ingredients')
      .select(selectWithCommon, { count: 'exact' });

    // Lọc theo từ khóa tìm kiếm (theo tên hoặc bí danh aliases)
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,aliases.cs.{${keyword}}`);
    }

    // Nếu người dùng yêu cầu chỉ lấy nguyên liệu phổ biến
    if (filterCommon) {
      query = query.eq('is_common', true);
    }

    const { data, count, error } = await query
      .range(offset, offset + limitNum - 1)
      .order('name', { ascending: true });

    // 2. Xử lý dự phòng nếu cơ sở dữ liệu chưa có cột is_common (Mã lỗi Postgres 42703 hoặc PGRST204)
    if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('is_common'))) {
      const selectWithoutCommon = `
        id,
        name,
        default_unit,
        allergen_group:allergen_groups(id, name)
      `;

      let retryQuery = supabaseAdmin
        .from('ingredients')
        .select(selectWithoutCommon, { count: 'exact' });

      if (keyword) {
        retryQuery = retryQuery.or(`name.ilike.%${keyword}%,aliases.cs.{${keyword}}`);
      }

      const retryResult = await retryQuery
        .range(offset, offset + limitNum - 1)
        .order('name', { ascending: true });

      if (retryResult.error) throw retryResult.error;

      const totalItems = retryResult.count || 0;
      return res.json({
        success: true,
        data: (retryResult.data || []).map((item) => ({
          ...item,
          is_common: false, // Giá trị mặc định khi DB chưa có cột is_common
        })),
        meta: {
          page: pageNum,
          limit: limitNum,
          total: totalItems,
          total_pages: Math.ceil(totalItems / limitNum),
        },
      });
    }

    // Nếu có lỗi khác ngoài 42703
    if (error) throw error;

    const totalCount = count || 0;
    return res.json({
      success: true,
      data: data || [],
      meta: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};
