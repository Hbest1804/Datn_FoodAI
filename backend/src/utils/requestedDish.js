// src/utils/requestedDish.js
// Nhận diện câu hỏi xin cách làm một món cụ thể ("cách làm bánh chưng", "công thức thịt đông")
// và kiểm tra món đó có trong danh sách món của hệ thống hay không (UC07 luồng 4a).
// Truy hồi bằng véc-tơ luôn trả về vài món gần nhất nên không tự biết món được hỏi có trong CSDL hay không:
// điểm cosine của câu chung chung có món trong CSDL ("bữa trưa dưới 400 kcal" ≈ 0,54) còn thấp hơn câu hỏi
// món không có ("bánh chưng" ≈ 0,61), vì vậy so theo tên món thay cho ngưỡng điểm.

import { normalizeText } from './textUtils.js';

// Cụm mở đầu câu xin công thức (đã bỏ dấu), theo sau là tên món
const VERBS = 'lam|nau|goi|che bien|kho|xao|nuong|chien|hap|do|pha|uop|tron|cuon|ham|rim|om|luoc|muoi|ngam|trang';
const REQUEST_RE = new RegExp(
  '(?:^|\\s)(?:'
  // "cách làm X", "hướng dẫn tôi cách nấu X", "chỉ mình làm X": bắt buộc có động từ nấu nướng
  + `(?:cach|(?:huong dan|chi|day)(?: (?:toi|minh|em|tui|giup|cho))*(?: cach)?) (?:${VERBS})`
  // "công thức X", "công thức làm X", "bí quyết nấu X"
  + `|(?:cong thuc|bi quyet)(?: (?:${VERBS}))?`
  + ')'
  + '(?: mon)? (.+)$',
);

// Phần sau tên món: điều kiện, thời điểm, từ cảm thán… cắt bỏ để chỉ còn tên món
const TAIL_RE = /(?:^|\s)(?:cho|de|voi|khong|duoi|tren|trong|khoang|it|nhu the nao|the nao|ra sao|sao|nhe|nha|nhi|a|di|ngay tet|dip tet|ngon|tai nha|o nha|don gian|chuan vi|kieu|gi|nhanh|bang|tu|sao cho|giup|duoc)(?:\s|$)/;

// Tên quá chung chung thì không coi là hỏi một món cụ thể
const GENERIC_TOKENS = new Set(['an', 'mon', 'do', 'gi', 'nay', 'nao', 'ngon', 'bua', 'com', 'nha']);
// Từ đứng đầu cho thấy đây là mẹo sơ chế/nấu nướng ("cách làm sạch lòng", "cách luộc cho mềm"), không phải tên món
const NOT_A_DISH_START = new Set(['sach', 'mem', 'gion', 'chin', 'thom', 'het', 'giam', 'bot', 'tang', 'khu', 'cho', 'sao', 'nhanh', 'ngon']);

/** Chuẩn hóa thành danh sách từ: bỏ dấu, chữ thường, bỏ dấu câu. */
function tokens(str) {
  return normalizeText(String(str || '')).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Lấy tên món người dùng xin cách làm. Trả về null nếu câu hỏi không phải dạng xin công thức một món cụ thể.
 * Ví dụ: "Hướng dẫn tôi cách gói bánh chưng" → "banh chung"; "Gợi ý món canh cho bữa tối" → null.
 */
// Hỏi số liệu của một món: "bánh flan bao nhiêu calo", "một khẩu phần phở bò bao nhiêu kcal", "bò kho có bao nhiêu protein"
const FACT_RE = /^(?:(?:mot|1) (?:khau phan|phan|to|dia|bat|cai|chiec|suat|ly|coc|chen) )?(?:mon )?(.+?) (?:co |chua )*(?:bao nhieu|may) (?:calo|kcal|cal|protein|dam|chat dam|tinh bot|carbs?|chat beo|beo|duong)\b/;

export function extractRequestedDish(content) {
  const text = tokens(content).join(' ');
  const m = text.match(REQUEST_RE) || text.match(FACT_RE);
  if (!m) return null;
  let name = m[1];
  const tail = name.match(TAIL_RE);
  if (tail) name = name.slice(0, tail.index);
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0 || NOT_A_DISH_START.has(words[0]) || words.every((w) => GENERIC_TOKENS.has(w))) return null;
  return words.join(' ');
}

/**
 * Món trong danh sách có tên khớp với tên món được hỏi: ít nhất 80% số từ của tên được hỏi
 * xuất hiện trong tên món (bỏ dấu). "pho bo" khớp "Phở bò tái nạm"; "banh chung" không khớp "Bánh cuốn…".
 */
export function findDishByRequestedName(requested, dishes = [], minCoverage = 0.8) {
  const want = tokens(requested);
  if (want.length === 0) return null;
  for (const d of dishes) {
    const have = new Set(tokens(d.name));
    const hit = want.filter((w) => have.has(w)).length;
    if (hit / want.length >= minCoverage) return d;
  }
  return null;
}
