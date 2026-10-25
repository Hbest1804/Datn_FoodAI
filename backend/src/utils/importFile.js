// src/utils/importFile.js
// Đọc file nhập dữ liệu (.xlsx bằng thư viện xlsx, .csv UTF-8) thành mảng dòng; dùng chung cho nhập món và nhập nguyên liệu.

import * as XLSX from 'xlsx';

/** Đọc CSV (dấu phẩy hoặc chấm phẩy, hỗ trợ ô trong ngoặc kép). */
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export const fileExtension = (file) => (file.originalname || '').toLowerCase().split('.').pop();

/**
 * Đọc toàn bộ file: .csv cho một bảng duy nhất; .xlsx cho tất cả sheet (tên sheet viết thường → mảng dòng).
 * Ném lỗi { status, code, message } khi file hỏng.
 */
export function readImportSheets(file) {
  if (fileExtension(file) === 'csv') {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw { status: 422, code: 'INVALID_FILE', message: 'File CSV phải mã hóa UTF-8.' };
    }
    const rows = parseCsv(text.replace(/^﻿/, ''));
    return { csv: true, first: rows, sheets: new Map() };
  }
  // .xlsx là file zip (PK..); chỉ đọc giá trị ô, không thực thi công thức/macro
  if (file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
    throw { status: 422, code: 'INVALID_FILE', message: 'File Excel bị hỏng hoặc không đúng định dạng .xlsx.' };
  }
  try {
    const wb = XLSX.read(file.buffer, { type: 'buffer', cellFormula: false, cellHTML: false });
    const sheets = new Map();
    for (const name of wb.SheetNames) {
      sheets.set(name.trim().toLowerCase(), XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: true }));
    }
    return { csv: false, first: sheets.get(wb.SheetNames[0]?.trim().toLowerCase()) || [], sheets };
  } catch {
    throw { status: 422, code: 'INVALID_FILE', message: 'File Excel bị hỏng hoặc không đọc được.' };
  }
}

/** Đọc một bảng: .xlsx lấy sheet `sheetName` (không phân biệt hoa thường), không có thì lấy sheet đầu tiên. */
export function readImportFile(file, { sheetName } = {}) {
  const book = readImportSheets(file);
  return (sheetName && book.sheets.get(sheetName.toLowerCase())) || book.first;
}

/**
 * Tách dòng tiêu đề và dòng dữ liệu của một bảng. Tên cột không phân biệt hoa thường, thứ tự tùy ý;
 * cột lạ bị bỏ qua (trả trong warnings); dòng trống hoàn toàn bị bỏ qua; row đánh số theo file (tiêu đề là dòng 1).
 * Thiếu tiêu đề hoặc cột bắt buộc → ném lỗi INVALID_TEMPLATE.
 */
export function parseTable(rows, { columns, required, label = '' }) {
  const where = label ? ` (sheet ${label})` : '';
  const header = (rows[0] || []).map((h) => String(h ?? '').trim().toLowerCase());
  if (header.length === 0 || header.every((h) => !h)) {
    throw { status: 422, code: 'INVALID_TEMPLATE', message: `File không có dòng tiêu đề${where}.` };
  }
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) {
    throw { status: 422, code: 'INVALID_TEMPLATE', message: `Thiếu cột bắt buộc${where}: ${missing.join(', ')}.` };
  }
  const warnings = header.filter((h) => h && !columns.includes(h)).map((h) => `Bỏ qua cột ${h}${where}`);
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] || [];
    if (cells.every((c) => String(c ?? '').trim() === '')) continue;
    const obj = {};
    header.forEach((h, idx) => { if (columns.includes(h)) obj[h] = cells[idx]; });
    data.push({ row: i + 1, obj });
  }
  return { data, warnings };
}

/** Ô đúng/sai: true/false, có/không (chấp nhận thêm 1/0, yes/no); ô trống → null; sai giá trị → undefined. */
export function parseFlag(raw) {
  const v = String(raw ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (v === '') return null;
  if (['true', '1', 'co', 'yes'].includes(v)) return true;
  if (['false', '0', 'khong', 'no'].includes(v)) return false;
  return undefined;
}

/** File mẫu .csv: dòng tiêu đề + dòng ví dụ, UTF-8 có BOM để Excel hiển thị đúng tiếng Việt. */
export function buildCsvTemplate(header, example) {
  const line = (cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  return `﻿${line(header)}\r\n${line(example)}\r\n`;
}

/** Ghi workbook .xlsx từ danh sách sheet [{ name, rows, cols }] (cols: độ rộng từng cột). */
export function buildXlsx(sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows, cols } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (cols) ws['!cols'] = cols.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
