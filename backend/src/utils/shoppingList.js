// src/utils/shoppingList.js
// Hàm thuần cho danh sách đi chợ (UC17, Tài liệu API mục 4.15): gộp đơn vị, cộng dồn nguyên liệu, sắp xếp, tóm tắt

/** Đơn vị quy đổi được: g/kg gộp về g, ml/l gộp về ml (luồng 4a). */
const CONVERTIBLE = {
  g: { key: 'g', factor: 1 },
  gam: { key: 'g', factor: 1 },
  gram: { key: 'g', factor: 1 },
  kg: { key: 'g', factor: 1000 },
  ml: { key: 'ml', factor: 1 },
  l: { key: 'ml', factor: 1000 },
  'lít': { key: 'ml', factor: 1000 },
  lit: { key: 'ml', factor: 1000 },
};

/**
 * Nhóm đơn vị để gộp. Đơn vị khác g/kg/ml/l giữ nguyên dạng chữ thường, gộp khoảng trắng.
 * @returns {{ key: string, factor: number }}
 */
export function unitKeyOf(unit) {
  const u = String(unit ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return CONVERTIBLE[u] || { key: u, factor: 1 };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Lượng theo đơn vị nhỏ → lượng và đơn vị hiển thị (từ 1.000 g/ml trở lên đổi sang kg/l). */
export function displayQuantity(baseQty, unitKey) {
  if (unitKey === 'g' && baseQty >= 1000) return { quantity: round2(baseQty / 1000), unit: 'kg' };
  if (unitKey === 'ml' && baseQty >= 1000) return { quantity: round2(baseQty / 1000), unit: 'l' };
  return { quantity: round2(baseQty), unit: unitKey };
}

/**
 * Cộng dồn nguyên liệu của các món còn khả dụng.
 * dishes: [{ dish_id, name, servings, recipe_servings }]
 * ingredients: [{ dish_id, ingredient_id, ingredient_name, quantity, unit, is_optional }]
 * Lượng = quantity × servings đã chọn ÷ servings của công thức, cộng theo (ingredient_id, unit_key).
 * @returns {Map<string, { ingredient_id, unit_key, name, base_quantity, is_optional, used_by }>}
 */
export function aggregateIngredients(dishes, ingredients) {
  const dishById = new Map(dishes.map((d) => [d.dish_id, d]));
  const groups = new Map();
  for (const ing of ingredients) {
    const dish = dishById.get(ing.dish_id);
    if (!dish) continue;
    const ratio = dish.servings / (dish.recipe_servings || dish.servings || 1);
    const { key, factor } = unitKeyOf(ing.unit);
    const groupKey = `${ing.ingredient_id}|${key}`;
    let g = groups.get(groupKey);
    if (!g) {
      g = {
        ingredient_id: ing.ingredient_id,
        unit_key: key,
        name: ing.ingredient_name,
        base_quantity: 0,
        is_optional: true,
        used_by: [],
      };
      groups.set(groupKey, g);
    }
    g.base_quantity += Number(ing.quantity) * factor * ratio;
    // Chỉ là tùy chọn khi mọi món dùng nguyên liệu này đều để tùy chọn
    g.is_optional = g.is_optional && Boolean(ing.is_optional);
    if (!g.used_by.some((u) => u.dish_id === dish.dish_id)) {
      g.used_by.push({ dish_id: dish.dish_id, name: dish.name });
    }
  }
  return groups;
}

export function itemGroupKey(item) {
  return `${item.ingredient_id}|${item.unit_key}`;
}

/**
 * So dòng tự động đang lưu với nhóm nguyên liệu vừa tính: dòng nào cần thêm, dòng nào cần xóa.
 * @returns {{ toInsert: Array<{ ingredient_id, unit_key }>, toDeleteIds: number[] }}
 */
export function diffAutoItems(storedAutoItems, groups) {
  const storedKeys = new Set(storedAutoItems.map(itemGroupKey));
  const toDeleteIds = storedAutoItems.filter((it) => !groups.has(itemGroupKey(it))).map((it) => it.id);
  const toInsert = [...groups.values()]
    .filter((g) => !storedKeys.has(`${g.ingredient_id}|${g.unit_key}`))
    .map((g) => ({ ingredient_id: g.ingredient_id, unit_key: g.unit_key }));
  return { toInsert, toDeleteIds };
}

/** Nhóm hiển thị của một dòng: cần mua → đã mua → đã có. */
export function itemStatus(item) {
  if (item.have_at_home) return 'have_at_home';
  if (item.purchased) return 'purchased';
  return 'to_buy';
}

const STATUS_ORDER = { to_buy: 0, purchased: 1, have_at_home: 2 };

export function sortItems(items) {
  return [...items].sort((a, b) => {
    const s = STATUS_ORDER[itemStatus(a)] - STATUS_ORDER[itemStatus(b)];
    if (s !== 0) return s;
    if (a.is_manual !== b.is_manual) return a.is_manual ? 1 : -1;
    if (a.is_manual) return a.id - b.id;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });
}

export function summarize(dishes, items) {
  const summary = { dish_count: dishes.length, to_buy: 0, have_at_home: 0, purchased: 0 };
  for (const it of items) summary[itemStatus(it)] += 1;
  return summary;
}
