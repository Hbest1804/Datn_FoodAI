// test/shoppingList.test.js
// Kiểm thử phần gộp nguyên liệu của danh sách đi chợ (UC17, mục 4.15)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateIngredients,
  diffAutoItems,
  displayQuantity,
  sortItems,
  summarize,
  unitKeyOf,
} from '../src/utils/shoppingList.js';

const dishA = { dish_id: 'a', name: 'Canh chua', servings: 4, recipe_servings: 2 };
const dishB = { dish_id: 'b', name: 'Cá kho', servings: 2, recipe_servings: 2 };

describe('unitKeyOf', () => {
  it('gộp g/kg về g và ml/l về ml', () => {
    assert.deepEqual(unitKeyOf('kg'), { key: 'g', factor: 1000 });
    assert.deepEqual(unitKeyOf(' G '), { key: 'g', factor: 1 });
    assert.deepEqual(unitKeyOf('L'), { key: 'ml', factor: 1000 });
    assert.deepEqual(unitKeyOf('lít'), { key: 'ml', factor: 1000 });
  });

  it('đơn vị khác giữ nguyên dạng chữ thường', () => {
    assert.deepEqual(unitKeyOf('Quả'), { key: 'quả', factor: 1 });
  });
});

describe('displayQuantity', () => {
  it('từ 1.000 g/ml đổi sang kg/l', () => {
    assert.deepEqual(displayQuantity(1500, 'g'), { quantity: 1.5, unit: 'kg' });
    assert.deepEqual(displayQuantity(999, 'g'), { quantity: 999, unit: 'g' });
    assert.deepEqual(displayQuantity(2000, 'ml'), { quantity: 2, unit: 'l' });
    assert.deepEqual(displayQuantity(3, 'quả'), { quantity: 3, unit: 'quả' });
  });
});

describe('aggregateIngredients', () => {
  const ings = [
    { dish_id: 'a', ingredient_id: 1, ingredient_name: 'Cà chua', quantity: 200, unit: 'g', is_optional: false },
    { dish_id: 'b', ingredient_id: 1, ingredient_name: 'Cà chua', quantity: 0.5, unit: 'kg', is_optional: true },
    { dish_id: 'b', ingredient_id: 1, ingredient_name: 'Cà chua', quantity: 2, unit: 'quả', is_optional: false },
    { dish_id: 'a', ingredient_id: 2, ingredient_name: 'Ngò', quantity: 10, unit: 'g', is_optional: true },
  ];
  const groups = aggregateIngredients([dishA, dishB], ings);

  it('nhân theo tỉ lệ khẩu phần và cộng dồn đơn vị quy đổi được', () => {
    // 200 g × 4/2 + 0,5 kg × 2/2 = 400 + 500
    assert.equal(groups.get('1|g').base_quantity, 900);
    assert.deepEqual(groups.get('1|g').used_by.map((u) => u.dish_id), ['a', 'b']);
  });

  it('khác đơn vị không quy đổi được thì tách dòng', () => {
    assert.equal(groups.get('1|quả').base_quantity, 2);
    assert.equal(groups.size, 3);
  });

  it('chỉ tùy chọn khi mọi món đều để tùy chọn', () => {
    assert.equal(groups.get('1|g').is_optional, false);
    assert.equal(groups.get('2|g').is_optional, true);
  });

  it('bỏ qua nguyên liệu của món không nằm trong danh sách khả dụng', () => {
    const only = aggregateIngredients([dishA], ings);
    assert.equal(only.get('1|g').base_quantity, 400);
    assert.equal(only.has('1|quả'), false);
  });
});

describe('diffAutoItems', () => {
  it('thêm nhóm mới, xóa dòng không còn món nào dùng', () => {
    const groups = aggregateIngredients([dishA], [
      { dish_id: 'a', ingredient_id: 1, ingredient_name: 'Cà chua', quantity: 1, unit: 'g' },
      { dish_id: 'a', ingredient_id: 3, ingredient_name: 'Hành', quantity: 1, unit: 'củ' },
    ]);
    const stored = [
      { id: 10, ingredient_id: 1, unit_key: 'g' },
      { id: 11, ingredient_id: 9, unit_key: 'g' },
    ];
    const { toInsert, toDeleteIds } = diffAutoItems(stored, groups);
    assert.deepEqual(toDeleteIds, [11]);
    assert.deepEqual(toInsert, [{ ingredient_id: 3, unit_key: 'củ' }]);
  });
});

describe('sortItems & summarize', () => {
  it('cần mua trước, rồi đã mua, cuối cùng là đã có', () => {
    const items = [
      { id: 1, is_manual: false, name: 'B', have_at_home: true, purchased: false },
      { id: 2, is_manual: true, name: 'Giấy bạc', have_at_home: false, purchased: false },
      { id: 3, is_manual: false, name: 'A', have_at_home: false, purchased: true },
      { id: 4, is_manual: false, name: 'C', have_at_home: false, purchased: false },
    ];
    assert.deepEqual(sortItems(items).map((i) => i.id), [4, 2, 3, 1]);
    assert.deepEqual(summarize([dishA], items), { dish_count: 1, to_buy: 2, have_at_home: 1, purchased: 1 });
  });
});
