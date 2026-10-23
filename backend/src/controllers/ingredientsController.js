// src/controllers/ingredientsController.js
// 4.2.2 Tìm nguyên liệu (gợi ý khi gõ) – GET /ingredients?q=&is_common=&page=&limit=

import { supabaseAdmin } from '../config/supabase.js';
import { normalizeText } from '../utils/textUtils.js';
import { pageMeta, parseBool, parsePagination, sendError, sendOk } from '../utils/http.js';

export async function getIngredients(req, res) {
  const pg = parsePagination(req.query);
  const isCommon = req.query.is_common === undefined ? undefined : parseBool(req.query.is_common);
  if (req.query.is_common !== undefined && isCommon === undefined) {
    return sendError(res, 400, 'INVALID_QUERY', 'is_common phải là true hoặc false.');
  }
  const keyword = typeof req.query.q === 'string' ? normalizeText(req.query.q).slice(0, 100) : '';

  let query = supabaseAdmin
    .from('ingredients')
    .select('id, name, normalized_name, aliases, default_unit, is_common, allergen_group:allergen_groups(id, name)')
    .order('name');
  if (isCommon === true) query = query.eq('is_common', true);
  const { data, error } = await query;
  if (error) throw error;

  // So khớp không dấu trên tên và bí danh; tên bắt đầu bằng từ khóa được xếp trước
  let rows = data || [];
  if (keyword) {
    rows = rows
      .map((r) => {
        const names = [r.normalized_name, ...(r.aliases || []).map(normalizeText)];
        const rank = names.some((n) => n.startsWith(keyword)) ? 0 : names.some((n) => n.includes(keyword)) ? 1 : -1;
        return { r, rank };
      })
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.r);
  }

  const items = rows.slice(pg.from, pg.to + 1).map((r) => ({
    id: Number(r.id),
    name: r.name,
    default_unit: r.default_unit,
    is_common: r.is_common,
    allergen_group: r.allergen_group || null,
  }));
  return sendOk(res, items, { meta: pageMeta(pg, rows.length) });
}
