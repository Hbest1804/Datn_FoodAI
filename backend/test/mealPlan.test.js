// test/mealPlan.test.js
// Kiểm thử phần xếp món của Gợi ý thực đơn tuần (UC17)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildPools,
  isValidWeekStart,
  mondayOf,
  planMeal,
  planWeek,
  roleOfCategory,
  todayVN,
} from '../src/utils/mealPlan.js';

// Bộ món giống dữ liệu demo: 15 canh, 30 món mặn, 28 rau/xào, 22 món sáng, 4 món kèm
function demoCandidates() {
  const list = [];
  const add = (category, n) => {
    for (let i = 0; i < n; i += 1) list.push({ id: `${category}-${i}`, category, score: Math.random() });
  };
  add('Món canh', 15);
  add('Món kho', 15);
  add('Món chiên nướng', 15);
  add('Món xào', 15);
  add('Món luộc & hấp', 7);
  add('Món gỏi & cuốn', 6);
  add('Món nước', 15);
  add('Cơm & Cháo', 7);
  add('Bánh truyền thống', 3);
  add('Tráng miệng', 1);
  return list;
}

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('roleOfCategory', () => {
  it('ánh xạ danh mục sang vai trò trong mâm, không phân biệt hoa thường/dấu cách', () => {
    assert.equal(roleOfCategory('Món canh'), 'soup');
    assert.equal(roleOfCategory('món kho'), 'main');
    assert.equal(roleOfCategory('Cơm & Cháo'), 'breakfast_main');
    assert.equal(roleOfCategory('Món gỏi & cuốn'), 'vegetable');
    assert.equal(roleOfCategory('Không có'), null);
  });
});

describe('planWeek', () => {
  const pools = buildPools(demoCandidates());
  const { items, missingRoles } = planWeek(pools, { random: seeded(42) });

  it('đủ 7 ngày × 3 bữa, không thiếu nhóm món bắt buộc', () => {
    assert.deepEqual(missingRoles, []);
    for (let d = 0; d < 7; d += 1) {
      for (const meal of ['breakfast', 'lunch', 'dinner']) {
        assert.ok(items.some((it) => it.day_index === d && it.meal === meal), `ngày ${d} ${meal}`);
      }
    }
  });

  it('sáng 1–2 món; trưa, tối 3–4 món gồm canh, món mặn, rau/xào', () => {
    for (let d = 0; d < 7; d += 1) {
      const breakfast = items.filter((it) => it.day_index === d && it.meal === 'breakfast');
      assert.ok(breakfast.length >= 1 && breakfast.length <= 2);
      for (const meal of ['lunch', 'dinner']) {
        const m = items.filter((it) => it.day_index === d && it.meal === meal);
        assert.ok(m.length >= 3 && m.length <= 4, `${meal} ngày ${d}: ${m.length} món`);
        const roles = m.map((it) => it.role);
        assert.ok(roles.includes('soup') && roles.includes('main') && roles.includes('vegetable'));
      }
    }
  });

  it('không lặp món trong cùng một ngày', () => {
    for (let d = 0; d < 7; d += 1) {
      const ids = items.filter((it) => it.day_index === d).map((it) => it.dish_id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it('món kèm bữa sáng không lặp trong tuần', () => {
    const sides = items.filter((it) => it.role === 'breakfast_side').map((it) => it.dish_id);
    assert.equal(new Set(sides).size, sides.length);
  });
});

describe('planWeek khi thiếu món (ví dụ người ăn chay)', () => {
  it('báo nhóm thiếu món và vẫn xếp được các nhóm còn lại', () => {
    const pools = buildPools([
      { id: 'chay-1', category: 'Món chay', score: 1 },
      { id: 'pho-chay', category: 'Món nước', score: 1 },
    ]);
    const { items, missingRoles } = planWeek(pools, { random: seeded(7) });
    assert.ok(missingRoles.includes('soup') && missingRoles.includes('main'));
    assert.ok(items.length > 0);
  });
});

describe('planMeal với exclude', () => {
  it('tránh món cũ khi còn lựa chọn khác', () => {
    const pools = buildPools([
      { id: 'canh-a', category: 'Món canh', score: 1 },
      { id: 'canh-b', category: 'Món canh', score: 0.1 },
    ]);
    const { items } = planMeal('lunch', pools, new Map(), new Set(), { exclude: new Set(['canh-a']), random: seeded(3) });
    assert.equal(items.find((it) => it.role === 'soup').dish_id, 'canh-b');
  });

  it('chỉ còn món cũ thì dùng lại', () => {
    const pools = buildPools([{ id: 'canh-a', category: 'Món canh', score: 1 }]);
    const { items } = planMeal('lunch', pools, new Map(), new Set(), { exclude: new Set(['canh-a']), random: seeded(3) });
    assert.equal(items.find((it) => it.role === 'soup').dish_id, 'canh-a');
  });
});

describe('Ngày trong tuần', () => {
  it('Thứ Hai của tuần và kiểm tra week_start', () => {
    assert.equal(mondayOf('2026-11-17'), '2026-11-16');
    assert.equal(mondayOf('2026-11-22'), '2026-11-16');
    assert.equal(mondayOf('2026-11-16'), '2026-11-16');
    assert.equal(addDays('2026-11-16', 7), '2026-11-23');
    assert.equal(isValidWeekStart('2026-11-16'), true);
    assert.equal(isValidWeekStart('2026-11-17'), false);
    assert.equal(isValidWeekStart('16/11/2026'), false);
  });

  it('ngày hôm nay theo giờ Việt Nam', () => {
    assert.equal(todayVN(new Date('2026-11-16T18:30:00Z')), '2026-11-17');
  });
});
