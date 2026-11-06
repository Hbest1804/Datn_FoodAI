// src/controllers/ingredientsController.js
// 4.2.2 Tìm nguyên liệu (gợi ý khi gõ) – GET /ingredients?q=&is_common=&page=&limit=

import { supabaseAdmin } from '../config/supabase.js';
import { normalizeText } from '../utils/textUtils.js';
import { pageMeta, parseBool, parsePagination, sendError, sendOk } from '../utils/http.js';

// Nguyên liệu phổ biến do hệ thống tự tính: N nguyên liệu được nhiều món đang hiển thị dùng nhất
const COMMON_LIMIT = 20;
const COMMON_TTL_MS = 10 * 60 * 1000;
let commonCache = { at: 0, ids: [] };

async function commonIngredientIds() {
  if (Date.now() - commonCache.at < COMMON_TTL_MS) return commonCache.ids;
  const counts = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('dish_ingredients')
      .select('ingredient_id, dishes!inner(is_published)')
      .eq('dishes.is_published', true)
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data || []) counts.set(Number(r.ingredient_id), (counts.get(Number(r.ingredient_id)) || 0) + 1);
    if (!data || data.length < 1000) break;
  }
  const ids = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, COMMON_LIMIT).map(([id]) => id);
  commonCache = { at: Date.now(), ids };
  return ids;
}

export async function getIngredients(req, res) {
  const pg = parsePagination(req.query);
  const isCommon = req.query.is_common === undefined ? undefined : parseBool(req.query.is_common);
  if (req.query.is_common !== undefined && isCommon === undefined) {
    return sendError(res, 400, 'INVALID_QUERY', 'is_common phải là true hoặc false.');
  }
  const keyword = typeof req.query.q === 'string' ? normalizeText(req.query.q).slice(0, 100) : '';

  const [{ data, error }, commonIds] = await Promise.all([
    supabaseAdmin
      .from('ingredients')
      .select('id, name, normalized_name, aliases, default_unit, allergen_group:allergen_groups(id, name)')
      .order('name'),
    commonIngredientIds(),
  ]);
  if (error) throw error;
  const commonRank = new Map(commonIds.map((id, i) => [id, i]));

  let rows = data || [];
  // is_common=true: chỉ nguyên liệu phổ biến, xếp theo số món dùng giảm dần
  if (isCommon === true) {
    rows = rows.filter((r) => commonRank.has(Number(r.id)))
      .sort((a, b) => commonRank.get(Number(a.id)) - commonRank.get(Number(b.id)));
  }

  // So khớp không dấu trên tên và bí danh; tên bắt đầu bằng từ khóa được xếp trước
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
    is_common: commonRank.has(Number(r.id)),
    allergen_group: r.allergen_group || null,
  }));
  return sendOk(res, items, { meta: pageMeta(pg, rows.length) });
}
