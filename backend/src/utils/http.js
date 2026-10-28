// src/utils/http.js
// Hàm dùng chung để trả kết quả đúng cấu trúc mục 2.2 và đọc tham số theo mục 2.3 của tài liệu API

import crypto from 'crypto';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lỗi nghiệp vụ có mã lỗi, ném ra ở tầng xử lý rồi để bộ xử lý lỗi chung trả về cho người gọi.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function sendError(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

export function sendOk(res, data, { status = 200, meta } = {}) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

/**
 * Gắn mã yêu cầu (request_id) cho mọi yêu cầu và tự chèn vào error.request_id khi trả lỗi.
 */
export function requestIdMiddleware(req, res, next) {
  req.id = `req_${crypto.randomBytes(4).toString('hex')}`;
  res.setHeader('X-Request-Id', req.id);
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success === false && body.error && !body.error.request_id) {
      body.error.request_id = req.id;
    }
    return originalJson(body);
  };
  next();
}

/** Giá trị đúng/sai theo quy ước mục 2.3: true | false (chấp nhận thêm 1/0). */
export function parseBool(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

/**
 * Phân trang: page (từ 1) và limit (mặc định 20, tối đa 100). Giá trị sai kiểu → 400 INVALID_QUERY.
 */
export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    throw new ApiError(400, 'INVALID_QUERY', 'Tham số phân trang không hợp lệ.');
  }
  const safeLimit = Math.min(limit, maxLimit);
  return { page, limit: safeLimit, from: (page - 1) * safeLimit, to: page * safeLimit - 1 };
}

export function pageMeta({ page, limit }, total, extra = {}) {
  const t = total || 0;
  return { page, limit, total: t, total_pages: Math.ceil(t / limit), ...extra };
}

/** Danh sách số nguyên dương cách nhau bằng dấu phẩy: "1,5,9". Sai định dạng → 400 INVALID_QUERY. */
export function parseIdList(value, field) {
  if (value === undefined || value === '') return null;
  const parts = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  const ids = parts.map(Number);
  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new ApiError(400, 'INVALID_QUERY', `Tham số ${field} không hợp lệ.`);
  }
  return [...new Set(ids)];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Khoảng ngày from/to dạng YYYY-MM-DD, mặc định 30 ngày gần nhất.
 * from > to hoặc khoảng > 366 ngày → 400 INVALID_DATE_RANGE.
 * Trả về mốc thời gian chuẩn ISO bao trọn cả ngày `to`.
 */
export function parseDateRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const toStr = query.to || today;
  const fromStr = query.from || new Date(Date.parse(`${toStr}T00:00:00Z`) - 30 * DAY_MS).toISOString().slice(0, 10);
  if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr) || Number.isNaN(Date.parse(fromStr)) || Number.isNaN(Date.parse(toStr))) {
    throw new ApiError(400, 'INVALID_QUERY', 'Ngày phải có định dạng YYYY-MM-DD.');
  }
  const fromMs = Date.parse(`${fromStr}T00:00:00Z`);
  const toMs = Date.parse(`${toStr}T00:00:00Z`);
  if (fromMs > toMs || (toMs - fromMs) / DAY_MS > 366) {
    throw new ApiError(400, 'INVALID_DATE_RANGE', 'Khoảng thời gian không hợp lệ (from > to hoặc vượt quá 366 ngày).');
  }
  return {
    from: fromStr,
    to: toStr,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs + DAY_MS - 1).toISOString(),
  };
}

/** Thao tác xóa bắt buộc confirm=true (mục 2.7, quy ước 3). */
export function requireConfirm(value) {
  if (parseBool(value) !== true) {
    throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Thao tác này cần xác nhận confirm=true.');
  }
}

/** Kiểm tra tham số đường dẫn: id không đúng định dạng uuid thì trả 404 với mã lỗi tương ứng. */
export function uuidParam(code, message) {
  return (req, res, next, value) => {
    if (!UUID_REGEX.test(String(value))) return sendError(res, 404, code, message);
    next();
  };
}
