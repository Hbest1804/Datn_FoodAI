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
 * Đồng nhất cách viết i/y ở cuối âm tiết sau phụ âm (mì/mỳ, kĩ/kỹ, lí/lý, quí/quý).
 * Không đụng tới vần ay/uy (tay ≠ tai) và chữ "y" đứng riêng (y tế).
 */
function unifyIY(str) {
  return str.replace(/\b(qu|[bcdghklmnprstvx]+)y\b/g, '$1i');
}

/**
 * Kiểm tra xem chuỗi nguồn có chứa từ khóa (không phân biệt hoa thường, dấu tiếng Việt và cách viết i/y) hay không
 */
export function matchesSearchKeyword(source, keyword) {
  if (!source || !keyword) return false;
  const cleanSource = unifyIY(normalizeText(source));
  const cleanKeyword = unifyIY(normalizeText(keyword));
  return cleanSource.includes(cleanKeyword);
}

/** Tạo đường dẫn rút gọn (slug) từ tên món: bỏ dấu, nối bằng gạch ngang. */
export function slugify(str) {
  return normalizeText(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
