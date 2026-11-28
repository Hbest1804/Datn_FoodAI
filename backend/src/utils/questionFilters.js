// src/utils/questionFilters.js
// Nhận diện điều kiện định lượng trong câu hỏi ("dưới 300 kcal", "trên 30 g protein", "ít tinh bột",
// "cho 4 người dưới 70.000 đồng", "dưới 20 phút", "món khó làm", "món kho"…) để lọc món theo số liệu CSDL
// trước khi gửi cho mô hình. Mô hình không tự so số liệu ổn định nên việc lọc làm ở đây.

import { normalizeText } from './textUtils.js';

const LESS = '(?:duoi|it hon|khong qua|toi da|nho hon|thap hon|<=?|≤)';
const MORE = '(?:tren|hon|nhieu hon|it nhat|toi thieu|lon hon|cao hon|>=?|≥)';

// "món kho", "các món canh"… → danh mục món (dishes.category)
const CATEGORY_RULES = [
  { re: /\bmon kho\b/, category: 'Món kho' },
  { re: /\bmon canh\b/, category: 'Món canh' },
  { re: /\bmon xao\b/, category: 'Món xào' },
  { re: /\bmon (?:chien|nuong)\b/, category: 'Món chiên nướng' },
  { re: /\bmon (?:goi|cuon)\b/, category: 'Món gỏi & cuốn' },
  { re: /\bmon nuoc\b/, category: 'Món nước' },
];

/** Đổi "70.000" / "70,5" / "70" + đơn vị ("k", "nghìn", "triệu", "đồng") ra số đồng. */
function parseMoney(numStr, unit) {
  let n = String(numStr);
  // Dấu chấm/phẩy theo sau đúng 3 chữ số là dấu phân cách hàng nghìn
  n = /^\d{1,3}([.,]\d{3})+$/.test(n) ? n.replace(/[.,]/g, '') : n.replace(',', '.');
  let v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (['k', 'nghin', 'ngan'].includes(unit)) v *= 1000;
  if (unit === 'trieu') v *= 1000000;
  return v;
}

/**
 * Đọc điều kiện trong câu hỏi. Trả về object (có thể rỗng):
 *   maxKcal, minKcal, minProtein, maxCarbs, lowCarb, maxCost, people, maxTime, difficulty ('easy'|'hard'),
 *   category, sortBy ('carbs_asc'|'protein_desc'|'kcal_asc') khi hỏi "…nhất".
 */
export function parseQuestionFilters(content) {
  const raw = String(content || '').normalize('NFC').toLowerCase();
  const t = normalizeText(raw).replace(/[^a-z0-9.,<>=≤≥\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const f = {};
  let m;

  if ((m = t.match(new RegExp(`${LESS} (\\d+) ?(?:kcal|calo|calories|cal)\\b`)))) f.maxKcal = Number(m[1]);
  if ((m = t.match(new RegExp(`${MORE} (\\d+) ?(?:kcal|calo|calories|cal)\\b`)))) f.minKcal = Number(m[1]);
  if ((m = t.match(new RegExp(`${MORE} (\\d+) ?(?:g|gam|gram)? ?(?:protein|dam|chat dam)\\b`)))) f.minProtein = Number(m[1]);
  if ((m = t.match(new RegExp(`${LESS} (\\d+) ?(?:g|gam|gram)? ?(?:tinh bot|carbs?|carbohydrate)\\b`)))) f.maxCarbs = Number(m[1]);
  else if (/\b(?:it|thap|khong co|khong) (?:tinh bot|carbs?)\b|\blow ?carb\b/.test(t)) f.lowCarb = true;

  if ((m = t.match(new RegExp(`${LESS} (\\d+(?:[.,]\\d+)*) ?(k|nghin|ngan|trieu|dong|d|vnd)\\b`)))) {
    const v = parseMoney(m[1], m[2]);
    if (v) f.maxCost = v;
  }
  if ((m = t.match(/\bcho (\d+) (?:nguoi|khau phan|suat|phan)\b/))) f.people = Number(m[1]);
  if ((m = t.match(/\b(?:duoi|trong vong|trong|khong qua|toi da|it hon) (\d+) ?(?:phut|p)\b/))) f.maxTime = Number(m[1]);

  // Độ khó: so trên chuỗi còn dấu vì "khó" và "kho" (món kho) giống nhau khi bỏ dấu
  if (/khó (?:làm|nấu)|món (?:nào )?khó|thử thách|cầu kỳ|phức tạp/.test(raw)) f.difficulty = 'hard';
  else if (/dễ (?:làm|nấu)|món (?:nào )?dễ/.test(raw)) f.difficulty = 'easy';

  for (const rule of CATEGORY_RULES) {
    // "món kho" trong chuỗi bỏ dấu cũng khớp "món khó" → loại trường hợp còn dấu là "khó"
    if (rule.re.test(t) && !(rule.category === 'Món kho' && /món khó/.test(raw) && !/món kho\b/.test(raw))) {
      f.category = rule.category;
      break;
    }
  }

  if (/\bnhat\b/.test(t)) {
    if (f.lowCarb || f.maxCarbs) f.sortBy = 'carbs_asc';
    else if (/\b(?:nhieu|giau) (?:dam|protein)\b/.test(t) || f.minProtein) f.sortBy = 'protein_desc';
    else if (/\bit (?:calo|kcal)\b/.test(t)) f.sortBy = 'kcal_asc';
  }
  return f;
}

/** Chi phí món cho `people` người (est_cost là chi phí cho `servings` khẩu phần). */
export function costFor(dish, people) {
  if (dish.est_cost == null) return null;
  const servings = Number(dish.servings) || 1;
  return people ? Math.round((Number(dish.est_cost) / servings) * people) : Number(dish.est_cost);
}

const DIFF_VI = { easy: 'dễ', medium: 'trung bình', hard: 'khó' };

/**
 * Danh sách bộ lọc theo thứ tự áp dụng: mỗi phần tử { label, test(dish) }.
 * Bộ lọc nào loại hết món thì bên gọi bỏ qua bộ lọc đó và báo cho mô hình.
 */
export function buildDishPredicates(f) {
  const n = (v) => (v == null ? null : Number(v));
  const list = [];
  if (f.category) list.push({ label: `loại "${f.category}"`, test: (d) => d.category === f.category });
  if (f.maxKcal != null) list.push({ label: `dưới ${f.maxKcal} kcal/khẩu phần`, test: (d) => n(d.calories) != null && n(d.calories) < f.maxKcal });
  if (f.minKcal != null) list.push({ label: `trên ${f.minKcal} kcal/khẩu phần`, test: (d) => n(d.calories) != null && n(d.calories) > f.minKcal });
  if (f.minProtein != null) list.push({ label: `từ ${f.minProtein} g đạm/khẩu phần`, test: (d) => n(d.protein_g) != null && n(d.protein_g) >= f.minProtein });
  if (f.maxCarbs != null) list.push({ label: `dưới ${f.maxCarbs} g tinh bột/khẩu phần`, test: (d) => n(d.carbs_g) != null && n(d.carbs_g) < f.maxCarbs });
  if (f.lowCarb) list.push({ label: 'ít tinh bột (≤ 10 g/khẩu phần)', test: (d) => n(d.carbs_g) != null && n(d.carbs_g) <= 10 });
  if (f.maxCost != null) {
    const who = f.people ? ` cho ${f.people} người` : '';
    list.push({ label: `chi phí dưới ${f.maxCost.toLocaleString('vi-VN')} đ${who}`, test: (d) => { const c = costFor(d, f.people); return c != null && c <= f.maxCost; } });
  }
  if (f.maxTime != null) list.push({ label: `nấu trong ${f.maxTime} phút`, test: (d) => n(d.cook_time_minutes) != null && n(d.cook_time_minutes) <= f.maxTime });
  if (f.difficulty === 'easy') list.push({ label: 'độ khó dễ', test: (d) => d.difficulty === 'easy' });
  if (f.difficulty === 'hard') list.push({ label: 'độ khó khó hoặc trung bình', test: (d) => d.difficulty === 'hard' || d.difficulty === 'medium' });
  return list;
}

/** Hàm so sánh phụ để xếp món theo yêu cầu "…nhất" / "món khó" (0 = giữ thứ tự điểm). */
export function metricComparator(f) {
  const v = (x) => (x == null ? null : Number(x));
  if (f.sortBy === 'carbs_asc') return (a, b) => (v(a.carbs_g) ?? 999) - (v(b.carbs_g) ?? 999);
  if (f.sortBy === 'protein_desc') return (a, b) => (v(b.protein_g) ?? -1) - (v(a.protein_g) ?? -1);
  if (f.sortBy === 'kcal_asc') return (a, b) => (v(a.calories) ?? 9999) - (v(b.calories) ?? 9999);
  if (f.difficulty === 'hard') return (a, b) => (b.difficulty === 'hard') - (a.difficulty === 'hard');
  return null;
}

export { DIFF_VI };
