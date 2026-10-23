// src/utils/textUtils.js
// Các hàm hỗ trợ chuẩn hóa chuỗi và tìm kiếm không dấu tiếng Việt

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa về chữ thường
 */
export function removeVietnameseTones(str) {
  if (!str || typeof str !== 'string') return '';
  let result = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  result = result.replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
  return result.toLowerCase().trim();
}

/**
 * Chuẩn hóa giống cột sinh tự động category_normalized / normalized_name trong CSDL:
 * chữ thường, bỏ dấu, gộp khoảng trắng.
 */
export function normalizeText(str) {
  return removeVietnameseTones(str).replace(/\s+/g, ' ');
}

/**
 * Kiểm tra xem chuỗi nguồn có chứa từ khóa (không phân biệt hoa thường và dấu tiếng Việt) hay không
 */
export function matchesSearchKeyword(source, keyword) {
  if (!source || !keyword) return false;
  const cleanSource = removeVietnameseTones(source);
  const cleanKeyword = removeVietnameseTones(keyword);
  return cleanSource.includes(cleanKeyword);
}

/** Tạo đường dẫn rút gọn (slug) từ tên món: bỏ dấu, nối bằng gạch ngang. */
export function slugify(str) {
  return normalizeText(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
