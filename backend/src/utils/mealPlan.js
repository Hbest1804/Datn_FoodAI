// src/utils/mealPlan.js
// Hàm thuần cho Gợi ý thực đơn tuần (UC17): cơ cấu mâm cơm, chọn món, ngày trong tuần

import { normalizeText } from './textUtils.js';

export const MEALS = ['breakfast', 'lunch', 'dinner'];
export const MEAL_LABELS = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' };
export const DAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

/** Vai trò của món trong mâm và các danh mục món được dùng cho vai trò đó. */
export const ROLES = {
  breakfast_main: { label: 'Món chính', categories: ['Món nước', 'Cơm & Cháo'] },
  breakfast_side: { label: 'Món kèm', categories: ['Bánh truyền thống', 'Tráng miệng'] },
  soup: { label: 'Canh', categories: ['Món canh'] },
  main: { label: 'Món mặn', categories: ['Món kho', 'Món chiên nướng'] },
  vegetable: { label: 'Rau, xào', categories: ['Món xào', 'Món luộc & hấp', 'Món gỏi & cuốn', 'Món chay'] },
};

/**
 * Cơ cấu từng bữa. required: luôn cố xếp (được lặp món đã dùng ở ngày khác nếu hết món mới);
 * optional: chỉ thêm khi còn món chưa dùng trong tuần → sáng 1–2 món, trưa/tối 3–4 món.
 */
export const MEAL_SLOTS = {
  breakfast: [
    { role: 'breakfast_main', required: true },
    { role: 'breakfast_side', required: false },
  ],
  lunch: [
    { role: 'soup', required: true },
    { role: 'main', required: true },
    { role: 'vegetable', required: true },
    { role: 'main', required: false },
  ],
  dinner: [
    { role: 'soup', required: true },
    { role: 'main', required: true },
    { role: 'vegetable', required: true },
    { role: 'main', required: false },
  ],
};

const CATEGORY_TO_ROLE = new Map();
for (const [role, def] of Object.entries(ROLES)) {
  for (const c of def.categories) CATEGORY_TO_ROLE.set(normalizeText(c), role);
}

export function roleOfCategory(category) {
  return CATEGORY_TO_ROLE.get(normalizeText(category || '')) || null;
}

/**
 * Chia món ứng viên (đã lọc an toàn và xếp theo điểm giảm dần) vào từng vai trò.
 * candidates: [{ id, category, score }]
 * @returns {Record<string, Array<{ id, score }>>}
 */
export function buildPools(candidates) {
  const pools = Object.fromEntries(Object.keys(ROLES).map((r) => [r, []]));
  for (const c of candidates) {
    const role = roleOfCategory(c.category);
    if (role) pools[role].push({ id: c.id, score: Number(c.score) || 0 });
  }
  return pools;
}

/**
 * Chọn một món cho vai trò: không trùng món đã có trong ngày, ưu tiên món ít dùng trong tuần,
 * sau đó điểm cao (có nhiễu ngẫu nhiên để mỗi lần gợi ý khác nhau).
 * usage: Map<dishId, số lần đã dùng trong tuần>; dayUsed: Set<dishId> của ngày đang xếp.
 */
export function pickDish(pool, { usage, dayUsed, exclude = new Set(), unusedOnly = false, random = Math.random }) {
  let best = null;
  let bestKey = null;
  for (const d of pool) {
    if (dayUsed.has(d.id) || exclude.has(d.id)) continue;
    const used = usage.get(d.id) || 0;
    if (unusedOnly && used > 0) continue;
    const key = [used, -(d.score * (0.6 + 0.4 * random()))];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = d;
      bestKey = key;
    }
  }
  return best ? best.id : null;
}

/**
 * Xếp một bữa (exclude: món nên tránh, ví dụ món cũ khi gợi ý lại bữa). Trả về các dòng { role, dish_id, position } và tên vai trò không xếp được (thiếu món phù hợp).
 */
export function planMeal(meal, pools, usage, dayUsed, { random = Math.random, exclude = new Set() } = {}) {
  const items = [];
  const missing = [];
  MEAL_SLOTS[meal].forEach((slot) => {
    // Món kèm bữa sáng chỉ thêm khoảng một nửa số ngày để bữa sáng có 1–2 món
    if (slot.role === 'breakfast_side' && random() < 0.5) return;
    const pool = pools[slot.role] || [];
    // Ưu tiên món khác với món đang có (exclude); hết lựa chọn thì mới dùng lại
    const dishId = pickDish(pool, { usage, dayUsed, exclude, unusedOnly: !slot.required, random })
      ?? (slot.required ? pickDish(pool, { usage, dayUsed, random }) : null);
    if (!dishId) {
      if (slot.required) missing.push(slot.role);
      return;
    }
    dayUsed.add(dishId);
    usage.set(dishId, (usage.get(dishId) || 0) + 1);
    items.push({ role: slot.role, dish_id: dishId, position: items.length });
  });
  return { items, missing };
}

/**
 * Xếp cả tuần (7 ngày × 3 bữa).
 * @returns {{ items: Array<{ day_index, meal, role, dish_id, position }>, missingRoles: string[] }}
 */
export function planWeek(pools, { random = Math.random } = {}) {
  const usage = new Map();
  const items = [];
  const missingRoles = new Set();
  for (let day = 0; day < 7; day += 1) {
    const dayUsed = new Set();
    for (const meal of MEALS) {
      const res = planMeal(meal, pools, usage, dayUsed, { random });
      res.items.forEach((it) => items.push({ day_index: day, meal, ...it }));
      res.missing.forEach((r) => missingRoles.add(r));
    }
  }
  return { items, missingRoles: [...missingRoles] };
}

/** Đếm số lần mỗi món xuất hiện trong danh sách dòng. */
export function countUsage(items) {
  const usage = new Map();
  for (const it of items) usage.set(it.dish_id, (usage.get(it.dish_id) || 0) + 1);
  return usage;
}

/** Cảnh báo khi thiếu món cho một vai trò (ví dụ người ăn chay gần như không có canh, món mặn phù hợp). */
export function missingWarning(roles) {
  if (!roles.length) return null;
  const names = roles.map((r) => ROLES[r]?.label || r).join(', ');
  return `Chưa đủ món phù hợp với hồ sơ của bạn cho nhóm: ${names}. Một số bữa sẽ ít món hơn.`;
}

// ── Ngày trong tuần (giờ Việt Nam) ───────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVN(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa ngày đã cho. */
export function mondayOf(dateStr) {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  const isoDow = ((new Date(ms).getUTCDay() + 6) % 7); // 0 = Thứ Hai
  return new Date(ms - isoDow * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** week_start hợp lệ: đúng định dạng và là Thứ Hai. */
export function isValidWeekStart(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) && mondayOf(value) === value;
}
