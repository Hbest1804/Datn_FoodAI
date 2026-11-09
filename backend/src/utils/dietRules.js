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
// Theo cách hiểu "ăn chay" ở Việt Nam: không ăn trứng (kể cả lòng đỏ, lòng trắng, trứng muối, trứng bắc thảo)
const EGGS = ['trứng', 'lòng đỏ', 'lòng trắng', 'mayonnaise'];
const ANIMAL_PRODUCTS = [...EGGS, 'sữa', 'sữa chua', 'bơ', 'bơ lạt', 'phô mai', 'kem', 'whey', 'mật ong'];

// Cụm trùng mặt chữ nhưng là thực vật / được phép (bị gỡ khỏi tên trước khi so khớp)
const PLANT_LOOKALIKES = ['nấm mỡ', 'khoai mỡ', 'thịt gấc', 'thịt quả', 'nấm đùi gà', 'nấm gan bò', 'đậu ngự', 'hạt nêm nấm', 'bột nêm nấm'];
// Chay vẫn được dùng sữa, bơ (chữ "bò" trong tên không bị coi là thịt bò)
const DAIRY_OK = ['sữa bò', 'bơ bò'];
const VEGAN_OK = ['sữa đậu nành', 'sữa hạt', 'sữa dừa', 'sữa yến mạch', 'sữa hạnh nhân', 'sữa gạo', 'nước cốt dừa',
  'quả bơ', 'trái bơ', 'bơ thực vật', 'bơ đậu phộng', 'kem dừa'];

/**
 * Luật theo mã chế độ. satisfiedBy: thẻ của các chế độ nào được coi là đạt (món thuần chay cũng là món chay).
 */
export const DIET_RULES = {
  vegetarian: {
    excludeRe: wordsRe([...MEAT, ...SEAFOOD, ...EGGS]),
    exceptRe: wordsRe([...PLANT_LOOKALIKES, ...DAIRY_OK]),
    satisfiedBy: ['vegetarian', 'vegan'],
    promptRule: 'theo cách ăn chay ở Việt Nam: không thịt, cá, hải sản, trứng, mỡ/nước dùng xương động vật, nước mắm, mắm, dầu hào (dùng nước tương, dầu hào chay, hạt nêm nấm thay thế); được dùng sữa',
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

// ── Chế độ ăn loại trừ nhau trong hồ sơ khẩu vị ──────────────────────────────
// "Bình thường" không đi cùng chế độ nào khác; "Ăn chay" và "Thuần chay" chỉ chọn một (trùng thì giữ Thuần chay,
// vì thuần chay đã bao gồm ăn chay). Nhận diện theo mã, thiếu mã thì theo tên (bỏ dấu).
const NORMAL_CODES = ['normal', 'regular', 'standard', 'binh_thuong'];

/** Nhóm loại trừ của một chế độ: 'normal' | 'vegetarian' | 'vegan' | null. */
export function dietExclusiveKind(diet) {
  const code = String(diet?.code || '').toLowerCase();
  const name = normalizeText(diet?.name || '');
  if (NORMAL_CODES.includes(code) || name === 'binh thuong') return 'normal';
  if (code === 'vegan' || name === 'thuan chay') return 'vegan';
  if (code === 'vegetarian' || name === 'an chay') return 'vegetarian';
  return null;
}

/**
 * Chuẩn hóa danh sách id chế độ ăn trước khi lưu: bỏ trùng, bỏ "Bình thường" khi có chế độ khác,
 * bỏ "Ăn chay" khi đã chọn "Thuần chay". `dietTypes`: [{ id, code, name }]. Id không có trong danh mục được giữ nguyên.
 */
export function normalizeDietSelection(dietIds, dietTypes = []) {
  const ids = [...new Set((dietIds || []).map(Number))];
  const kindOf = new Map(dietTypes.map((d) => [Number(d.id), dietExclusiveKind(d)]));
  const kinds = new Set(ids.map((id) => kindOf.get(id)));
  const hasOther = ids.some((id) => kindOf.get(id) !== 'normal');
  const firstNormal = ids.find((id) => kindOf.get(id) === 'normal');
  return ids.filter((id) => {
    const kind = kindOf.get(id);
    if (kind === 'normal') return !hasOther && id === firstNormal;
    if (kind === 'vegetarian') return !kinds.has('vegan');
    return true;
  });
}
