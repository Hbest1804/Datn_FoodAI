// src/utils/jsonReply.js
// Đọc JSON trả lời của mô hình (không phụ thuộc cấu hình/CSDL): bỏ rào ```json, cắt chữ thừa,
// JSON hỏng hoặc bị cắt thì tách lại từng trường. Dùng bởi services/aiService.js.

/**
 * Mô hình đôi khi để dấu " chưa thoát trong "content" (vd: "chữa cháy") làm JSON hỏng.
 * Tách lại từng trường bằng biểu thức chính quy; không tách được thì trả null.
 */
function salvageJsonReply(text) {
  // Chuỗi content kết thúc trước trường kế tiếp hoặc dấu }; bị cắt giữa chừng (chạm giới hạn token) thì lấy tới hết
  let raw = text.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"(?:matched_dish_ids|outcome|type)"|\}\s*$)/)?.[1];
  if (raw === undefined) {
    raw = text.match(/"content"\s*:\s*"([\s\S]*)$/)?.[1];
    if (raw === undefined) return null;
    raw = raw.replace(/\\$/, '') + '…'; // bị cắt giữa chừng: bỏ ký tự thoát dở dang, đánh dấu còn tiếp
  }
  const idsBlock = text.match(/"matched_dish_ids"\s*:\s*\[([\s\S]*?)\]/)?.[1] || '';
  const content = raw
    .replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    .trim();
  if (!content) return null;
  return {
    outcome: text.match(/"outcome"\s*:\s*"(\w+)"/)?.[1],
    type: text.match(/"type"\s*:\s*"(\w+)"/)?.[1],
    content,
    matched_dish_ids: [...idsBlock.matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  };
}

/**
 * Đọc JSON mô hình trả về: bỏ rào ```json, cắt chữ thừa trước dấu { đầu / sau dấu } cuối,
 * JSON hỏng hoặc bị cắt thì tách lại từng trường. Trả { parsed, cleaned }; parsed = null nếu không phải JSON.
 */
export function readJsonReply(rawText) {
  let cleaned = (rawText || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidates = [cleaned];
  if (start > 0 || (end !== -1 && end < cleaned.length - 1)) candidates.push(cleaned.slice(start, end + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object') return { parsed, cleaned };
    } catch { /* thử cách khác */ }
  }
  return { parsed: salvageJsonReply(start >= 0 ? cleaned.slice(start) : cleaned), cleaned };
}
