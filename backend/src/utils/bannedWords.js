// src/utils/bannedWords.js
// Bộ lọc danh sách từ ngữ bị cấm cho bình luận & đánh giá (Kiểm duyệt nội dung)

const BANNED_PATTERNS = [
  // Từ ngữ tục tĩu / chửi bậy phổ biến tiếng Việt
  /\bđịt\b/i,
  /\bđit\b/i,
  /\bđm\b/i,
  /\bdcm\b/i,
  /\bđcm\b/i,
  /\bđkm\b/i,
  /\bvcl\b/i,
  /\bvl\b/i,
  /\blồn\b/i,
  /\blon\b/i,
  /\bcặc\b/i,
  /\bcac\b/i,
  /\bbuồi\b/i,
  /\bđéo\b/i,
  /\bđếch\b/i,
  /\bchó chết\b/i,
  /\bkhốn nạn\b/i,
  /\bđĩ\b/i,
  /\bphò\b/i,
  /\bngu lồn\b/i,
  /\bóc chó\b/i,
  
  // Hành vi lừa đảo / spam / phản cảm
  /\blừa đảo\b/i,
  /\bđa cấp lừa\b/i,
  /\bbắn cá đổi thưởng\b/i,
  /\bcá độ\b/i,
  /\bđánh bạc\b/i,
  /\bsex\b/i,
  /\bporn\b/i,
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /\basshole\b/i,
];

/**
 * Kiểm tra xem chuỗi có chứa từ ngữ bị cấm không
 * @param {string} text - Nội dung bình luận cần kiểm tra
 * @returns {boolean} true nếu phát hiện từ cấm
 */
export function containsBannedWords(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase();
  return BANNED_PATTERNS.some((regex) => regex.test(normalized));
}
