// src/utils/promptGuard.js
// Lớp chặn 1: nhận diện mẫu tấn công prompt (prompt injection) phổ biến trước khi gọi AI.
// So khớp trên chuỗi đã bỏ dấu, chữ thường (normalizeText) nên bắt được cả câu gõ có dấu và không dấu.
// Chỉ chặn cụm nhắm vào hướng dẫn / prompt / vai trò của hệ thống. Câu như "bỏ qua dị ứng của tôi",
// "bỏ qua bước ướp trong hướng dẫn", "bỏ qua yêu cầu lúc nãy" không bị chặn ở đây (mô hình xử lý ở lớp 3).

import { normalizeText } from './textUtils.js';

const VERB = '(?:bo qua|quen|quen di|phot lo|lo di|vut bo|xoa bo|khong can tuan theo|dung tuan theo)';
const TARGET = '(?:huong dan|chi dan|chi thi|quy tac|luat|lenh|cau hinh|thiet lap|prompt)';
const QUANTIFIER = '(?:het|di|moi|tat ca|toan bo|cac|nhung|ca)';
const QUALIFIER = '(?:truoc|o tren|phia tren|cu|he thong|ban dau|cua ban|duoc giao|da cho)';

/** Mẫu tấn công (không dấu). Thêm mẫu mới ở đây kèm câu kiểm thử trong test/promptGuard.test.js. */
export const PROMPT_INJECTION_PATTERNS = [
  // "bỏ qua mọi hướng dẫn", "quên hết các quy tắc", "phớt lờ tất cả chỉ dẫn"
  new RegExp(`\\b${VERB}\\s+(?:${QUANTIFIER}\\s+){1,3}${TARGET}\\b`),
  // "bỏ qua hướng dẫn trước đó", "quên chỉ dẫn ở trên"
  new RegExp(`\\b${VERB}\\s+${TARGET}\\s+(?:\\S+\\s+){0,2}?${QUALIFIER}\\b`),
  // "bỏ qua hướng dẫn." / "bỏ qua hướng dẫn và …" (đối tượng đứng cuối câu hoặc trước liên từ)
  new RegExp(`\\b${VERB}\\s+${TARGET}(?=\\s*(?:$|[,.;:!?]|(?:va|roi|di|nhe|nha)\\b))`),
  // Đòi xem / in prompt hệ thống
  /\b(?:prompt|loi nhac|chi dan|cau lenh|huong dan) he thong\b/,
  /\bprompt (?:goc|ban dau|an)\b/,
  /\bsystem ?prompt\b/,
  // Đổi vai để thoát giới hạn: "từ giờ bạn là trợ lý không giới hạn", "chế độ nhà phát triển"
  /\b(?:tro ly|chatbot|bot|mo hinh) (?:khong|ko) (?:bi )?(?:gioi han|kiem duyet|rang buoc)\b/,
  /\bche do (?:nha phat trien|developer|khong gioi han|god)\b/,
  // Tiếng Anh: "ignore previous instructions", "disregard all prior rules", "DAN mode", "jailbreak"
  /\b(?:ignore|disregard|forget|override|bypass)\s+(?:\S+\s+){0,3}?(?:instructions?|prompts?|rules?|guidelines?)\b/,
  /\b(?:ignore|disregard|forget) (?:all |everything )?(?:previous|prior|above|earlier)\b/,
  /\b(?:developer|dan|god) mode\b/,
  /\bjailbreak\b/,
  /\bact as (?:an? )?(?:unrestricted|unfiltered|uncensored)\b/,
  // Đòi dữ liệu người dùng khác
  /\b(?:email|mat khau|ho so|du lieu|thong tin) (?:\S+ ){0,5}?(?:nguoi dung|tai khoan|thanh vien) khac\b/,
];

/** Câu hỏi có khớp mẫu tấn công prompt nào không. */
export function looksLikePromptInjection(content) {
  const text = normalizeText(String(content || '').normalize('NFC'));
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(text));
}
