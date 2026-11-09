// test/dietRules.test.js
// Luật chế độ ăn bắt buộc: nguyên liệu vi phạm chay / thuần chay và nhận diện "ăn chay" trong câu hỏi

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectQuestionDietCodes, normalizeDietSelection, violatesDiet } from '../src/utils/dietRules.js';

describe('violatesDiet', () => {
  it('chay: loại thịt, cá, hải sản và gia vị động vật', () => {
    for (const n of ['Thịt heo bằm', 'Sườn non heo', 'Cánh gà', 'Cá lóc', 'Tôm sú tươi', 'Nước mắm', 'Dầu hào',
      'Mắm tôm', 'Hạt nêm', 'Xương ống bò', 'Lòng mề gà', 'Chả lụa, giá đỗ', 'Thịt bằm và trứng (làm chả)']) {
      assert.equal(violatesDiet(n, 'vegetarian'), true, n);
    }
  });

  it('chay (cách hiểu ở Việt Nam): loại trứng', () => {
    for (const n of ['Trứng gà', 'Trứng cút', 'Trứng vịt muối', 'Lòng đỏ trứng', 'Lòng trắng trứng', 'Mayonnaise']) {
      assert.equal(violatesDiet(n, 'vegetarian'), true, n);
    }
  });

  it('chay: giữ thực vật, sữa và các tên trùng mặt chữ', () => {
    for (const n of ['Đậu hũ chiên', 'Nấm rơm tươi', 'Nấm đùi gà', 'Dầu hào chay', 'Nước tương', 'Khoai mỡ tím',
      'Thịt gấc đỏ', 'Bơ lạt', 'Sữa bò tươi', 'Sữa đậu nành', 'Hạt nêm nấm', 'Bí đỏ', 'Trứng chay']) {
      assert.equal(violatesDiet(n, 'vegetarian'), false, n);
    }
  });

  it('thuần chay: loại thêm trứng, sữa, bơ, mật ong; giữ sữa thực vật', () => {
    for (const n of ['Trứng gà', 'Bơ lạt', 'Mật ong', 'Tương ớt, mayonnaise', 'Thịt bò']) {
      assert.equal(violatesDiet(n, 'vegan'), true, n);
    }
    for (const n of ['Sữa đậu nành', 'Nước cốt dừa', 'Đậu hũ non', 'Dầu hào chay']) {
      assert.equal(violatesDiet(n, 'vegan'), false, n);
    }
  });

  it('chế độ mềm không loại nguyên liệu', () => {
    assert.equal(violatesDiet('Thịt bò', 'eat_clean'), false);
  });
});

describe('detectQuestionDietCodes', () => {
  it('nhận diện ăn chay trong câu hỏi (câu 25, 32, 38 bộ đánh giá)', () => {
    assert.deepEqual(detectQuestionDietCodes('Tôi ăn chay trường, gợi ý thực đơn 1 ngày.'), ['vegetarian']);
    assert.deepEqual(detectQuestionDietCodes('Món chay nhanh cho bữa tối.'), ['vegetarian']);
    assert.deepEqual(detectQuestionDietCodes('Tôi dị ứng đậu nành, gợi ý món chay.'), ['vegetarian']);
    assert.deepEqual(detectQuestionDietCodes('toi an chay, nau gi'), ['vegetarian']);
  });

  it('nhận diện thuần chay', () => {
    assert.deepEqual(detectQuestionDietCodes('Tôi ăn thuần chay'), ['vegan']);
    assert.deepEqual(detectQuestionDietCodes('vegan recipes please'), ['vegan']);
  });

  it('bỏ qua phủ định và câu không nói về chay', () => {
    assert.deepEqual(detectQuestionDietCodes('Tôi không ăn chay, gợi ý món thịt'), []);
    assert.deepEqual(detectQuestionDietCodes('toi khong an chay'), []);
    assert.deepEqual(detectQuestionDietCodes('Gợi ý vài món keto kiểu Việt.'), []);
    assert.deepEqual(detectQuestionDietCodes('Tủ lạnh còn trứng, cà chua, nấu gì?'), []);
  });
});

describe('normalizeDietSelection', () => {
  const types = [
    { id: 1, code: 'normal', name: 'Bình thường' },
    { id: 2, code: 'eat_clean', name: 'Eat Clean' },
    { id: 3, code: 'vegetarian', name: 'Ăn chay' },
    { id: 4, code: 'vegan', name: 'Thuần chay' },
    { id: 5, name: 'Keto / Low-Carb' },
  ];

  it('bỏ trùng và giữ chế độ không loại trừ nhau', () => {
    assert.deepEqual(normalizeDietSelection([2, 5, 2, '3'], types), [2, 5, 3]);
  });

  it('"Bình thường" bị bỏ khi có chế độ khác, giữ khi đi một mình', () => {
    assert.deepEqual(normalizeDietSelection([1, 2], types), [2]);
    assert.deepEqual(normalizeDietSelection([1], types), [1]);
  });

  it('Ăn chay và Thuần chay chỉ giữ Thuần chay', () => {
    assert.deepEqual(normalizeDietSelection([3, 4, 2], types), [4, 2]);
  });

  it('nhận diện theo tên khi thiếu mã', () => {
    const byName = [{ id: 7, name: 'Bình thường' }, { id: 8, name: 'Ăn chay' }, { id: 9, name: 'Thuần chay' }];
    assert.deepEqual(normalizeDietSelection([7, 8, 9], byName), [9]);
  });
});
