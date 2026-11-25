// test/requestedDish.test.js
// Nhận diện câu hỏi xin cách làm một món cụ thể và kiểm tra món đó có trong hệ thống không (UC07 luồng 4a)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRequestedDish, findDishByRequestedName } from '../src/utils/requestedDish.js';

const DISHES = [
  'Phở bò tái nạm', 'Canh chua cá lóc', 'Sườn non rim mặn ngọt', 'Mực xào chua ngọt', 'Bánh cuốn nhân thịt mộc nhĩ',
  'Thịt kho tàu trứng vịt', 'Cá lóc kho tộ', 'Bún bò Huế', 'Chè hạt sen long nhãn', 'Sườn cốt lết nướng mật ong',
  'Gà nướng muối ớt', 'Cải thìa xào nấm đông cô', 'Bún thái hải sản',
].map((name) => ({ name }));

describe('extractRequestedDish', () => {
  it('lấy tên món từ câu xin công thức', () => {
    assert.equal(extractRequestedDish('Hướng dẫn tôi cách gói bánh chưng'), 'banh chung');
    assert.equal(extractRequestedDish('Cách làm thịt đông ngày Tết'), 'thit dong');
    assert.equal(extractRequestedDish('cách nấu canh chua cá lóc cho 4 người?'), 'canh chua ca loc');
    assert.equal(extractRequestedDish('Công thức bánh flan'), 'banh flan');
    assert.equal(extractRequestedDish('Gợi ý cách làm sườn xào chua ngọt'), 'suon xao chua ngot');
    assert.equal(extractRequestedDish('chỉ mình làm bánh tét'), 'banh tet');
  });

  it('không coi câu gợi ý chung hay mẹo nấu nướng là xin một món cụ thể', () => {
    for (const q of ['Gợi ý cho tôi một món canh cho bữa tối', 'Gợi ý bữa trưa dưới 400 kcal',
      'Tôi có thịt bò và hành tây nấu gì', 'Cách làm sạch lòng heo', 'Cách khử mùi tanh của cá',
      'Cách nấu món gì ngon', 'Giá vàng hôm nay bao nhiêu?']) {
      assert.equal(extractRequestedDish(q), null, q);
    }
  });
});

describe('findDishByRequestedName', () => {
  it('khớp món có trong hệ thống', () => {
    assert.equal(findDishByRequestedName('pho bo', DISHES)?.name, 'Phở bò tái nạm');
    assert.equal(findDishByRequestedName('canh chua ca loc', DISHES)?.name, 'Canh chua cá lóc');
    assert.equal(findDishByRequestedName('thit kho trung', DISHES)?.name, 'Thịt kho tàu trứng vịt');
    assert.equal(findDishByRequestedName('bun bo', DISHES)?.name, 'Bún bò Huế');
  });

  it('không khớp món chỉ giống một phần', () => {
    for (const q of ['banh chung', 'thit dong', 'lau thai', 'che buoi', 'suon xao chua ngot', 'ga nuong mat ong', 'chao long']) {
      assert.equal(findDishByRequestedName(q, DISHES), null, q);
    }
  });
});
