// src/utils/textUtils.js
// Các hàm hỗ trợ chuẩn hóa chuỗi và tìm kiếm không dấu tiếng Việt

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa về chữ thường
 * @param {string} str
 * @returns {string}
 */
export function removeVietnameseTones(str) {
  if (!str || typeof str !== 'string') return '';
  let result = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  result = result.replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
  return result.toLowerCase().trim();
}

/**
 * Kiểm tra xem chuỗi nguồn có chứa từ khóa (không phân biệt hoa thường và dấu tiếng Việt) hay không
 * @param {string} source
 * @param {string} keyword
 * @returns {boolean}
 */
export function matchesSearchKeyword(source, keyword) {
  if (!source || !keyword) return false;
  const cleanSource = removeVietnameseTones(source);
  const cleanKeyword = removeVietnameseTones(keyword);
  return cleanSource.includes(cleanKeyword);
}
