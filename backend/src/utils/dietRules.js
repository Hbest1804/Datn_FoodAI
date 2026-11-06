// src/utils/dietRules.js
// Luật chế độ ăn bắt buộc (không truy cập CSDL): nguyên liệu nào vi phạm chế độ chay / thuần chay
// và nhận diện chế độ người dùng nêu trong câu hỏi. Dùng bởi services/dietService.js và phần nhập công thức.

import { normalizeText, wordsRe } from './textUtils.js';

const MEAT = [
  'thịt', 'bò', 'heo', 'lợn', 'gà', 'vịt', 'ngan', 'ngỗng', 'dê', 'cừu', 'thỏ', 'chim cút', 'bồ câu', 'ếch', 'lươn',
  'sườn', 'ba chỉ', 'ba rọi', 'nạc', 'giò', 'chả', 'nem chua', 'xúc xích', 'lạp xưởng', 'pate', 'pa tê', 'jambon',
  'dăm bông', 'bacon', 'mỡ', 'tóp mỡ', 'da heo', 'bì', 'gan', 'lòng', 'mề', 'tim', 'cật', 'dồi', 'tiết', 'huyết',
  'xương', 'móng', 'gân', 'nội tạng', 'gelatin', 'hạt nêm', 'bột nêm',
];
const SEAFOOD = [
  'cá', 'tôm', 'tép', 'cua', 'ghẹ', 'ruốc', 'mực', 'bạch tuộc', 'ngao', 'nghêu', 'sò', 'hến', 'hàu', 'ốc', 'sứa',
  'mắm', 'nước mắm', 'mắm tôm', 'mắm ruốc', 'dầu hào', 'hải sản',
];
const ANIMAL_PRODUCTS = ['trứng', 'sữa', 'sữa chua', 'bơ', 'bơ lạt', 'phô mai', 'kem', 'whey', 'mayonnaise', 'mật ong'];

// Cụm trùng mặt chữ nhưng là thực vật / được phép (bị gỡ khỏi tên trước khi so khớp)
const PLANT_LOOKALIKES = ['nấm mỡ', 'khoai mỡ', 'thịt gấc', 'thịt quả', 'nấm đùi gà', 'nấm gan bò', 'đậu ngự', 'hạt nêm nấm', 'bột nêm nấm'];
const DAIRY_EGG_OK = ['trứng gà', 'trứng vịt', 'trứng cút', 'trứng ngỗng', 'lòng đỏ', 'lòng trắng', 'sữa bò', 'bơ bò'];
const VEGAN_OK = ['sữa đậu nành', 'sữa hạt', 'sữa dừa', 'sữa yến mạch', 'sữa hạnh nhân', 'sữa gạo', 'nước cốt dừa',
  'quả bơ', 'trái bơ', 'bơ thực vật', 'bơ đậu phộng', 'kem dừa'];

/**
 * Luật theo mã chế độ. satisfiedBy: thẻ của các chế độ nào được coi là đạt (món thuần chay cũng là món chay).
 */
export const DIET_RULES = {
  vegetarian: {
    excludeRe: wordsRe([...MEAT, ...SEAFOOD]),
    exceptRe: wordsRe([...PLANT_LOOKALIKES, ...DAIRY_EGG_OK]),
    satisfiedBy: ['vegetarian', 'vegan'],
    promptRule: 'không thịt, cá, hải sản, mỡ/nước dùng xương động vật, nước mắm, mắm, dầu hào (dùng nước tương, dầu hào chay, hạt nêm nấm thay thế); được dùng trứng, sữa',
  },
  vegan: {
    excludeRe: wordsRe([...MEAT, ...SEAFOOD, ...ANIMAL_PRODUCTS]),
    exceptRe: wordsRe([...PLANT_LOOKALIKES, ...VEGAN_OK]),
    satisfiedBy: ['vegan'],
    promptRule: 'như ăn chay và không trứng, sữa, bơ, phô mai, mật ong hay bất kỳ sản phẩm động vật nào',
  },
};
// Dùng khi CSDL chưa chạy migration thêm diet_types.is_strict
export const DEFAULT_STRICT_CODES = Object.keys(DIET_RULES);

/** Nguyên liệu có vi phạm chế độ `code` không. Tên có chữ "chay" (chả chay, dầu hào chay…) luôn được coi là thực vật. */
export function violatesDiet(ingredientName, code) {
  const rule = DIET_RULES[code];
  if (!rule) return false;
  let name = String(ingredientName || '').normalize('NFC').toLowerCase();
  if (wordsRe(['chay']).test(name)) return false;
  // Gỡ các cụm được phép (thay bằng dấu cách để không dính chữ hai bên) rồi mới so khớp
  for (let prev = null; prev !== name;) { prev = name; name = name.replace(rule.exceptRe, ' '); }
  return rule.excludeRe.test(name);
}

// ── Chế độ ăn nêu ngay trong câu hỏi ("tôi ăn chay trường…", "gợi ý món chay") ─
const VEGAN_Q = ['thuần chay', 'vegan', 'chay tuyệt đối', 'ăn chay không trứng sữa'];
const VEGAN_Q_PLAIN = ['thuan chay', 'vegan'];
const VEGETARIAN_Q = ['chay', 'chay trường', 'chay tịnh', 'vegetarian'];
const VEGETARIAN_Q_PLAIN = ['an chay', 'mon chay', 'do chay', 'com chay', 'chay truong', 'thuc don chay', 'vegetarian'];
// Phủ định ngay trước cụm chế độ, có dấu hoặc không dấu ("không ăn chay", "khong can an chay")
const NEGATION_RE = /(?:^|[^\p{L}])(?:không|khong|chẳng|chang|ko)\s+(?:(?:cần|can|phải|phai|ăn|an|muốn|muon)\s+)*$/u;

function mentionedWithoutNegation(text, re) {
  const g = new RegExp(re.source, 'gu');
  for (const m of text.matchAll(g)) {
    if (!NEGATION_RE.test(text.slice(0, m.index + (m[0].match(/^[^\p{L}]/u) ? 1 : 0)))) return true;
  }
  return false;
}

/**
 * Mã chế độ bắt buộc người dùng nêu trong câu hỏi: ['vegan'] | ['vegetarian'] | [].
 * Nhận cả câu gõ không dấu ("an chay", "mon chay"); bỏ qua câu phủ định ("không ăn chay").
 */
export function detectQuestionDietCodes(content) {
  const text = String(content || '').normalize('NFC').toLowerCase();
  const plain = normalizeText(content);
  if (mentionedWithoutNegation(text, wordsRe(VEGAN_Q)) || mentionedWithoutNegation(plain, wordsRe(VEGAN_Q_PLAIN))) return ['vegan'];
  if (mentionedWithoutNegation(text, wordsRe(VEGETARIAN_Q)) || mentionedWithoutNegation(plain, wordsRe(VEGETARIAN_Q_PLAIN))) return ['vegetarian'];
  return [];
}
