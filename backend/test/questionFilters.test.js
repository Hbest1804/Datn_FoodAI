// test/questionFilters.test.js
// Nhận diện điều kiện định lượng trong câu hỏi để lọc món theo số liệu CSDL

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDishPredicates, costFor, parseQuestionFilters } from '../src/utils/questionFilters.js';

describe('parseQuestionFilters', () => {
  it('đọc calo, độ khó', () => {
    assert.deepEqual(parseQuestionFilters('Món nào dễ làm mà dưới 300 kcal một khẩu phần?'), { maxKcal: 300, difficulty: 'easy' });
    assert.deepEqual(parseQuestionFilters('Gợi ý bữa tối dưới 400 kcal.'), { maxKcal: 400 });
  });

  it('đọc đạm, tinh bột', () => {
    assert.equal(parseQuestionFilters('Gợi ý món nhiều đạm, trên 30 g protein mỗi khẩu phần.').minProtein, 30);
    assert.deepEqual(parseQuestionFilters('Món nào ít tinh bột nhất cho bữa tối?'), { lowCarb: true, sortBy: 'carbs_asc' });
    assert.equal(parseQuestionFilters('Còn mực, hành lá với gừng, nấu món gì ít tinh bột?').lowCarb, true);
  });

  it('đọc chi phí, số người, loại món', () => {
    assert.deepEqual(parseQuestionFilters('Món kho nào nấu cho 4 người mà chi phí dưới 70.000 đồng?'),
      { maxCost: 70000, people: 4, category: 'Món kho' });
    assert.equal(parseQuestionFilters('Có món nào dưới 50k không?').maxCost, 50000);
    assert.equal(parseQuestionFilters('toi an chay, goi y mon xao nhanh cho bua toi').category, 'Món xào');
  });

  it('đọc thời gian', () => {
    assert.equal(parseQuestionFilters('Gợi ý vài món nấu dưới 20 phút cho bữa tối.').maxTime, 20);
    assert.equal(parseQuestionFilters('Có món canh nào nấu trong 20 phút không?').maxTime, 20);
  });

  it('phân biệt "món khó" với "món kho"', () => {
    const f = parseQuestionFilters('Mình muốn thử thách tay nghề, trong hệ thống có món nào khó làm không?');
    assert.equal(f.difficulty, 'hard');
    assert.equal(f.category, undefined);
  });

  it('câu hỏi không có điều kiện trả về rỗng', () => {
    assert.deepEqual(parseQuestionFilters('Cách nấu thịt kho tàu trứng vịt?'), {});
    assert.deepEqual(parseQuestionFilters('Chào bạn!'), {});
  });

  it('đọc số món người dùng yêu cầu', () => {
    assert.deepEqual(parseQuestionFilters('Tư vấn 1 món canh cho bữa tối'), { category: 'Món canh', dishCount: 1 });
    assert.equal(parseQuestionFilters('gợi ý một món xào nhanh').dishCount, 1);
    assert.equal(parseQuestionFilters('Gợi ý 3 món ăn chuẩn vị cho cả gia đình').dishCount, 3);
    assert.equal(parseQuestionFilters('Gợi ý món canh cho bữa tối').dishCount, undefined);
    assert.equal(parseQuestionFilters('Món này nấu cho 4 người được không?').dishCount, undefined);
    assert.equal(parseQuestionFilters('Từ món này có thể biến tấu gì?').dishCount, undefined);
  });
});

describe('buildDishPredicates', () => {
  it('tính chi phí theo số người', () => {
    const d = { est_cost: 60000, servings: 3 };
    assert.equal(costFor(d, 4), 80000);
    const [cost] = buildDishPredicates({ maxCost: 70000, people: 4 });
    assert.equal(cost.test(d), false);
    assert.equal(cost.test({ est_cost: 50000, servings: 4 }), true);
  });
});
