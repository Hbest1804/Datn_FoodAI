// test/allergenRules.test.js
// Dị ứng nêu trong câu hỏi chatbot: nhận diện nhóm, xử lý phủ định, câu không dấu và quy ra nguyên liệu

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_ALLERGENS, detectQuestionAllergenGroups, ingredientMatchesAllergen } from '../src/utils/allergenRules.js';

const codes = (q) => detectQuestionAllergenGroups(q).map((a) => a.code).sort();
const allergen = (code) => QUESTION_ALLERGENS.find((a) => a.code === code);

describe('detectQuestionAllergenGroups', () => {
  it('nhận diện nhóm dị ứng sau "dị ứng", "không ăn được", "kiêng"', () => {
    assert.deepEqual(codes('Tôi dị ứng tôm, gợi ý món trưa'), ['crustacean']);
    assert.deepEqual(codes('Con tôi dị ứng đậu phộng, gợi ý vài món cuốn'), ['peanut']);
    assert.deepEqual(codes('Mình không ăn được hải sản'), ['seafood']);
    assert.deepEqual(codes('Tôi kiêng trứng và sữa nên muốn món chiên'), ['dairy', 'egg']);
  });

  it('bỏ qua câu phủ định', () => {
    assert.deepEqual(codes('Tôi không dị ứng tôm đâu, gợi ý món tôm'), []);
    assert.deepEqual(codes('Nhà tôi chẳng bị dị ứng gì cả'), []);
    assert.deepEqual(codes('Tôi không kiêng gì, gợi ý món ngon'), []);
    assert.deepEqual(codes('Tôi không dị ứng tôm nhưng dị ứng đậu phộng'), ['peanut']);
  });

  it('câu không dấu: chỉ nhận từ không mơ hồ', () => {
    assert.deepEqual(codes('toi di ung tom, goi y mon an trua'), ['crustacean']);
    assert.deepEqual(codes('be bi di ung dau phong'), ['peanut']);
    assert.deepEqual(codes('toi khong di ung tom'), []);
    // "cua" có thể là "của", "ca" có thể là "cà": không suy đoán
    assert.deepEqual(codes('di ung cua toi khong nang'), []);
  });

  it('câu không nêu dị ứng thì không lọc', () => {
    assert.deepEqual(codes('Gợi ý món tôm cho bữa tối'), []);
  });
});

describe('ingredientMatchesAllergen', () => {
  it('quy nhóm dị ứng ra nguyên liệu, gồm gia vị ẩn và trừ cụm được phép', () => {
    assert.equal(ingredientMatchesAllergen('Mắm ruốc Huế', allergen('crustacean')), true);
    assert.equal(ingredientMatchesAllergen('Nước mắm', allergen('fish')), true);
    assert.equal(ingredientMatchesAllergen('Dầu hào chay', allergen('seafood')), false);
    assert.equal(ingredientMatchesAllergen('Sữa đậu nành', allergen('dairy')), false);
    assert.equal(ingredientMatchesAllergen('Nước tương', allergen('soy')), true);
    assert.equal(ingredientMatchesAllergen('Cà chua', allergen('fish')), false);
  });
});
