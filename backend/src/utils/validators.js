// src/utils/validators.js
// Các hàm kiểm tra dữ liệu đầu vào dùng chung cho toàn bộ máy chủ.

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
 * Làm sạch từ khóa tìm kiếm trước khi đưa vào điều kiện lọc .or()
 * Loại bỏ các ký tự đặc biệt có thể làm thay đổi cú pháp truy vấn: , ( ) . % " ' \ { } :
 */
export function sanitizeSearchKeyword(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[,().%"'\\{}:]/g, '')
    .trim()
    .slice(0, 100);
}


/**
 * Đọc thông tin xác thực đặt lại mật khẩu (4.1.6, 4.1.7) từ body:
 * { token } (liên kết trong email) hoặc { email, code } (mã 6 số nhập tay).
 * Trả về { credentials } khi hợp lệ, ngược lại { errors } theo trường.
 */
export function parseResetCredentials(body) {
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (token) {
    if (token.length < 32 || token.length > 128) {
      return { errors: [{ field: 'token', code: 'INVALID_TOKEN', message: 'Liên kết đặt lại mật khẩu không hợp lệ.' }] };
    }
    return { credentials: { token } };
  }
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const errors = [];
  if (!isValidEmail(email)) errors.push({ field: 'email', code: 'INVALID_EMAIL', message: 'Email sai định dạng.' });
  if (!/^\d{6}$/.test(code)) errors.push({ field: 'code', code: 'INVALID_CODE', message: 'Mã xác thực gồm đúng 6 chữ số.' });
  return errors.length ? { errors } : { credentials: { email, code } };
}
