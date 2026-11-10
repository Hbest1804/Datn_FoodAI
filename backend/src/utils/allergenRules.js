// src/utils/allergenRules.js
// Nhận diện dị ứng người dùng nêu ngay trong câu hỏi chatbot ("tôi dị ứng hải sản, …") – không truy cập CSDL.
// Bảng nguyên liệu gần như chưa gắn nhóm dị ứng nên quy ra nguyên liệu theo tên (có dấu, khớp trọn từ),
// gồm cả gia vị ẩn chứa chất gây dị ứng như nước mắm, mắm tôm, nước tương, dầu hào.

import { normalizeText, wordsRe } from './textUtils.js';

const CRUSTACEAN = ['tôm', 'tép', 'cua', 'ghẹ', 'ruốc', 'riêu', 'giáp xác'];
const FISH = ['cá', 'nước mắm', 'mắm cá', 'chả cá', 'khô cá'];

/**
 * detect: cụm có dấu nhận ra nhóm dị ứng; detectPlain: cụm không dấu chỉ gồm từ không mơ hồ
 * (bỏ "ca" vì trùng "cà", "cua" trùng "của", "me" trùng "mẹ", "sua" trùng "sửa", "lac" trùng "lạc đường").
 * ingredients: tên nguyên liệu bị loại; except: cụm được gỡ khỏi tên trước khi so khớp.
 */
export const QUESTION_ALLERGENS = [
  {
    code: 'crustacean', name: 'Tôm, cua và hải sản có vỏ (giáp xác)',
    detect: CRUSTACEAN, detectPlain: ['tom', 'tep', 'ghe', 'giap xac'], ingredients: CRUSTACEAN,
  },
  {
    code: 'seafood', name: 'Hải sản (tôm, cua, cá, mực, nhuyễn thể)', detect: ['hải sản'], detectPlain: ['hai san'],
    ingredients: [...CRUSTACEAN, ...FISH, 'mực', 'bạch tuộc', 'ngao', 'nghêu', 'sò', 'hến', 'hàu', 'ốc', 'mắm', 'dầu hào'],
    except: ['dầu hào chay'],
  },
  { code: 'fish', name: 'Cá (kể cả nước mắm)', detect: ['cá'], detectPlain: [], ingredients: FISH },
  {
    code: 'peanut', name: 'Đậu phộng (lạc)', detect: ['đậu phộng', 'lạc'], detectPlain: ['dau phong'],
    ingredients: ['đậu phộng', 'lạc'],
  },
  {
    code: 'dairy', name: 'Sữa bò và chế phẩm từ sữa', detect: ['sữa', 'lactose'], detectPlain: ['lactose', 'sua bo'],
    ingredients: ['sữa', 'bơ lạt', 'bơ', 'phô mai', 'kem', 'whey'],
    except: ['sữa đậu nành', 'sữa hạt', 'sữa dừa', 'hàu sữa'],
  },
  { code: 'egg', name: 'Trứng', detect: ['trứng'], detectPlain: ['trung'], ingredients: ['trứng', 'mayonnaise'] },
  {
    code: 'gluten', name: 'Gluten (lúa mì)', detect: ['gluten', 'lúa mì', 'bột mì'], detectPlain: ['gluten', 'lua mi', 'bot mi'],
    ingredients: ['bột mì', 'bánh mì', 'mì tôm', 'mì gói', 'bánh bao', 'bột chiên giòn', 'bột chiên xù', 'nước tương', 'xì dầu', 'bia'],
  },
  {
    code: 'soy', name: 'Đậu nành', detect: ['đậu nành', 'đậu tương'], detectPlain: ['dau nanh', 'dau tuong'],
    ingredients: ['đậu nành', 'đậu tương', 'đậu phụ', 'đậu hũ', 'tàu hũ', 'tào phớ', 'váng đậu', 'nước tương', 'xì dầu', 'tương đen', 'tương bần', 'miso', 'dầu hào'],
  },
  { code: 'sesame', name: 'Vừng (mè)', detect: ['mè', 'vừng'], detectPlain: ['vung'], ingredients: ['mè', 'vừng', 'tahini'] },
  {
    code: 'tree_nut', name: 'Các loại hạt cây (điều, óc chó, hạnh nhân…)',
    detect: ['hạt điều', 'óc chó', 'hạnh nhân', 'macca', 'mắc ca', 'hồ đào', 'hạt dẻ', 'hạt cây'],
    detectPlain: ['hat dieu', 'oc cho', 'hanh nhan', 'macca', 'mac ca', 'ho dao', 'hat de', 'hat cay'],
    ingredients: ['hạt điều', 'óc chó', 'hạnh nhân', 'macca', 'mắc ca', 'hồ đào', 'hạt dẻ'],
  },
];

for (const a of QUESTION_ALLERGENS) {
  a.detectRe = wordsRe(a.detect);
  a.detectPlainRe = a.detectPlain.length ? wordsRe(a.detectPlain) : null;
  a.ingredientRe = wordsRe(a.ingredients);
  a.exceptRe = a.except ? wordsRe(a.except) : null;
}

// Cụm báo hiệu dị ứng; phần nêu chất gây dị ứng kéo dài tới dấu câu hoặc liên từ kế tiếp
const STOP = '(?=[,.;:!?\\n]|\\s(?:thì|nên|nhưng|mà|muốn|có|ăn|làm|gợi|cho|thi|nen|nhung|ma|muon|co|an|lam|goi)\\s|$)';
const ALLERGY_TRIGGER_RE = new RegExp(`(dị ứng|không ăn được|kiêng)\\s+([^,.;:!?\\n]*?)${STOP}`, 'gu');
const ALLERGY_TRIGGER_PLAIN_RE = new RegExp(`(di ung|khong an duoc|kieng)\\s+([^,.;:!?\\n]*?)${STOP}`, 'gu');
// Phủ định ngay trước cụm báo hiệu: "không dị ứng tôm", "chẳng bị dị ứng gì", "ko kiêng"
const NEGATION_RE = /(?:^|[^\p{L}])(?:không|khong|chẳng|chang|hông|ko|k)\s+(?:(?:hề|he|bị|bi|có|co|cần|can|phải|phai)\s+)*$/u;

function mentionedParts(text, re) {
  return [...text.matchAll(re)]
    .filter((m) => !NEGATION_RE.test(text.slice(0, m.index)))
    .map((m) => m[2]);
}

/**
 * Các nhóm dị ứng người dùng nêu trong câu hỏi (bỏ qua câu phủ định như "tôi không dị ứng tôm").
 * Câu có dấu so với danh sách detect; câu gõ không dấu chỉ so với detectPlain (từ không mơ hồ).
 */
export function detectQuestionAllergenGroups(content) {
  const text = String(content || '').normalize('NFC').toLowerCase();
  const accented = mentionedParts(text, ALLERGY_TRIGGER_RE).join(' | ');
  const plain = mentionedParts(normalizeText(content), ALLERGY_TRIGGER_PLAIN_RE).join(' | ');
  if (!accented && !plain) return [];
  return QUESTION_ALLERGENS.filter((a) =>
    (accented && a.detectRe.test(accented)) || (plain && a.detectPlainRe && a.detectPlainRe.test(plain)));
}

/** Tên nguyên liệu có thuộc nhóm dị ứng `allergen` không. */
export function ingredientMatchesAllergen(ingredientName, allergen) {
  const name = String(ingredientName || '').normalize('NFC').toLowerCase();
  return allergen.ingredientRe.test(allergen.exceptRe ? name.replace(allergen.exceptRe, ' ') : name);
}
