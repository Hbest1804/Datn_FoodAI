// src/utils/validators.js
// Tập hợp các hàm validate dùng chung cho toàn bộ backend.

/**
 * Kiểm tra định dạng email hợp lệ.
 */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Kiểm tra độ mạnh mật khẩu theo yêu cầu nghiệp vụ:
 * - Tối thiểu 8 ký tự
 * - Gồm ít nhất 1 chữ HOA, 1 chữ thường, 1 chữ số
 */
export function isStrongPassword(password) {
  return typeof password === 'string' && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

/**
 * Làm sạch từ khóa tìm kiếm trước khi truyền vào PostgREST .or() filter
 * Loại bỏ các ký tự đặc biệt có thể thay đổi cú pháp logic truy vấn của PostgREST: , ( ) . % " ' \ { } :
 */
export function sanitizeSearchKeyword(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[,().%"'\\{}:]/g, '')
    .trim()
    .slice(0, 100);
}

