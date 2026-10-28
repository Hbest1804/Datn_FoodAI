// src/controllers/adminIngredientsController.js
// Admin – Nhập danh sách nguyên liệu từ file Excel/CSV (mục 4.14.5 – 4.14.6, UC16 luồng 2a).

import { supabaseAdmin } from '../config/supabase.js';
import { recordAuditLog } from '../services/auditService.js';
import { clearRecommendationCache } from '../services/recommendationService.js';
import { buildCsvTemplate, buildXlsx, fileExtension, parseFlag, parseTable, readImportFile, XLSX_MIME } from '../utils/importFile.js';
import { normalizeText } from '../utils/textUtils.js';
import { parseBool, sendError, sendOk } from '../utils/http.js';

const IMPORT_COLUMNS = ['name', 'default_unit', 'allergen_group_code', 'aliases', 'is_common', 'parent_names'];
const REQUIRED_COLUMNS = ['name', 'default_unit'];
const MAX_IMPORT_ROWS = 2000;
const EXAMPLE_ROW = ['Tôm sú', 'g', 'shellfish', 'tôm hùm sú', 'false', 'Tôm'];
const COMMON_UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'củ', 'tép', 'lát', 'bó', 'muỗng canh', 'muỗng cà phê', 'chén'];

const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

/**
 * 4.14.5 Tải file mẫu nhập nguyên liệu – GET /admin/ingredients/import/template?format=xlsx|csv
 */
export async function adminGetIngredientImportTemplate(req, res) {
  const format = req.query.format ?? 'xlsx';
  if (!['xlsx', 'csv'].includes(format)) return sendError(res, 400, 'INVALID_QUERY', 'format phải là xlsx hoặc csv.');

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-nguyen-lieu.csv"');
    return res.send(buildCsvTemplate(IMPORT_COLUMNS, EXAMPLE_ROW));
  }

  const { data: groups } = await supabaseAdmin.from('allergen_groups').select('code, name').order('id');
  const guide = [
    ['Cột', 'Bắt buộc', 'Mô tả'],
    ['name', 'Có', 'Tên chuẩn của nguyên liệu.'],
    ['default_unit', 'Có', 'Đơn vị mặc định (g, ml, quả, muỗng canh…).'],
    ['allergen_group_code', 'Không', 'Mã nhóm dị ứng (bảng bên dưới); để trống nếu không thuộc nhóm nào.'],
    ['aliases', 'Không', 'Tên gọi khác, phân tách bằng dấu ";".'],
    ['is_common', 'Không', 'Nguyên liệu phổ biến: true/false hoặc có/không (mặc định false).'],
    ['parent_names', 'Không', 'Nhóm nguyên liệu (nguyên liệu gốc), phân tách bằng ";": người dùng kiêng nguyên liệu gốc thì món chứa nguyên liệu này cũng bị ẩn. Ví dụ Tôm sú → "Tôm"; Gan heo, đậu phộng → "Thịt heo; Đậu phộng". Nguyên liệu gốc phải đã có hoặc nằm trong cùng file. Để trống khi cập nhật thì giữ nhóm cũ.'],
    [],
    ['Mã nhóm dị ứng', 'Tên nhóm'],
    ...(groups || []).map((g) => [g.code, g.name]),
    [],
    ['Đơn vị thường dùng'],
    ...COMMON_UNITS.map((u) => [u]),
  ];

  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-nguyen-lieu.xlsx"');
  return res.send(buildXlsx([
    { name: 'nguyen_lieu', rows: [IMPORT_COLUMNS, EXAMPLE_ROW], cols: [20, 14, 22, 30, 12, 24] },
    { name: 'Huong_dan', rows: guide, cols: [22, 12, 70] },
  ]));
}

/**
 * 4.14.6 Nhập nguyên liệu từ file Excel/CSV – POST /admin/ingredients/import (biểu mẫu: file, dry_run, on_duplicate)
 */
export async function adminImportIngredients(req, res) {
  if (!req.file) return sendError(res, 400, 'FILE_REQUIRED', 'Thiếu trường file.');
  if (!['xlsx', 'csv'].includes(fileExtension(req.file))) {
    return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận file .xlsx hoặc .csv.');
  }
  const dryRun = req.body?.dry_run === undefined || req.body.dry_run === '' ? true : parseBool(req.body.dry_run);
  if (dryRun === undefined) return sendError(res, 422, 'VALIDATION_ERROR', 'dry_run phải là true hoặc false.');
  const onDuplicate = req.body?.on_duplicate || 'skip';
  if (!['skip', 'update'].includes(onDuplicate)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'on_duplicate phải là skip hoặc update.');
  }

  let dataRows;
  let warnings;
  try {
    const sheet = readImportFile(req.file, { sheetName: 'nguyen_lieu' });
    ({ data: dataRows, warnings } = parseTable(sheet, { columns: IMPORT_COLUMNS, required: REQUIRED_COLUMNS }));
  } catch (err) {
    if (err.code) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
  if (dataRows.length === 0) return sendError(res, 422, 'INVALID_TEMPLATE', 'File không có dòng dữ liệu nào.');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return sendError(res, 422, 'TOO_MANY_ROWS', `File có ${dataRows.length} dòng, tối đa ${MAX_IMPORT_ROWS} dòng dữ liệu.`);
  }

  const [ingRes, groupRes, linkRes] = await Promise.all([
    supabaseAdmin.from('ingredients').select('id, name, normalized_name, aliases, default_unit, allergen_group_id, is_common'),
    supabaseAdmin.from('allergen_groups').select('id, code'),
    supabaseAdmin.from('ingredient_parents').select('ingredient_id, parent_id'),
  ]);
  if (ingRes.error) throw ingRes.error;
  if (groupRes.error) throw groupRes.error;
  if (linkRes.error) throw linkRes.error;
  // Nguyên liệu đã có theo tên chuẩn và tên gọi khác (đã chuẩn hóa)
  const existingByKey = new Map();
  for (const ing of ingRes.data || []) {
    existingByKey.set(ing.normalized_name, ing);
    (ing.aliases || []).forEach((a) => { if (!existingByKey.has(normalizeText(a))) existingByKey.set(normalizeText(a), ing); });
  }
  const groupByCode = new Map((groupRes.data || []).map((g) => [g.code.toLowerCase(), g.id]));

  const errors = [];
  let toCreate = [];
  let toUpdate = [];
  const skipped = [];
  const rowByKey = new Map();      // tên/tên gọi khác trong file → dòng đầu tiên dùng nó
  const rowByExisting = new Map(); // id nguyên liệu đã có → dòng đầu tiên trùng với nó
  const rowNode = new Map();       // dòng hợp lệ → nút trong đồ thị nhóm: id nguyên liệu đã có, hoặc "new:<dòng>"

  for (const { row, obj } of dataRows) {
    const rowErrors = [];
    const err = (field, code, message) => rowErrors.push({ row, field, code, message });

    const name = cleanName(obj.name);
    const defaultUnit = cleanName(obj.default_unit);
    if (!name) err('name', 'REQUIRED', 'Tên nguyên liệu không được để trống.');
    if (!defaultUnit) err('default_unit', 'REQUIRED', 'Đơn vị mặc định không được để trống.');

    const groupCode = String(obj.allergen_group_code ?? '').trim().toLowerCase();
    const allergenGroupId = groupCode ? groupByCode.get(groupCode) : null;
    if (groupCode && allergenGroupId === undefined) {
      err('allergen_group_code', 'ALLERGEN_GROUP_NOT_FOUND', `Mã nhóm dị ứng "${groupCode}" không tồn tại.`);
    }

    const isCommon = parseFlag(obj.is_common);
    if (isCommon === undefined) err('is_common', 'INVALID_VALUE', 'is_common chỉ nhận true/false hoặc có/không.');

    // Tên gọi khác: bỏ ô trống, bỏ trùng và bỏ tên trùng với tên chuẩn
    const nameKey = normalizeText(name);
    const aliases = [];
    const aliasKeys = [];
    for (const a of String(obj.aliases ?? '').split(';').map(cleanName).filter(Boolean)) {
      const key = normalizeText(a);
      if (key === nameKey || aliasKeys.includes(key)) continue;
      aliases.push(a);
      aliasKeys.push(key);
    }

    // Nhóm nguyên liệu (nguyên liệu gốc), không được là chính nó
    const parents = [];
    for (const p of String(obj.parent_names ?? '').split(';').map(cleanName).filter(Boolean)) {
      if (!parents.some((x) => x.key === normalizeText(p))) parents.push({ name: p, key: normalizeText(p) });
    }
    if (parents.some((p) => p.key === nameKey || aliasKeys.includes(p.key))) {
      err('parent_names', 'SELF_PARENT', 'Nguyên liệu không thể thuộc nhóm của chính nó.');
    }

    // Trùng giữa các dòng trong file (theo tên chuẩn và tên gọi khác)
    if (name) {
      const keys = [nameKey, ...aliasKeys];
      const clashKey = keys.find((k) => rowByKey.has(k));
      if (clashKey !== undefined) {
        err(clashKey === nameKey ? 'name' : 'aliases', 'DUPLICATE_IN_FILE', `Trùng với nguyên liệu ở dòng ${rowByKey.get(clashKey)}.`);
      }
      keys.forEach((k) => { if (!rowByKey.has(k)) rowByKey.set(k, row); });
    }

    // So trùng với nguyên liệu đã có
    const existing = name ? existingByKey.get(nameKey) || aliasKeys.map((k) => existingByKey.get(k)).find(Boolean) : null;
    if (existing) {
      const firstRow = rowByExisting.get(existing.id);
      if (firstRow === undefined) rowByExisting.set(existing.id, row);
      else if (!rowErrors.some((e) => e.code === 'DUPLICATE_IN_FILE')) {
        err('name', 'DUPLICATE_IN_FILE', `Cùng nguyên liệu "${existing.name}" với dòng ${firstRow}.`);
      }
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    if (!existing) {
      rowNode.set(row, `new:${row}`);
      toCreate.push({
        row,
        node: `new:${row}`,
        parents,
        values: { name, default_unit: defaultUnit, allergen_group_id: allergenGroupId, aliases, is_common: isCommon ?? false },
      });
    } else if (onDuplicate === 'skip') {
      rowNode.set(row, String(existing.id));
      skipped.push({ row, name, existing_id: Number(existing.id) });
    } else {
      rowNode.set(row, String(existing.id));
      // Gộp tên gọi khác, không xóa tên gọi cũ; tên trong file khác tên chuẩn thì thêm làm tên gọi khác
      const merged = [...(existing.aliases || [])];
      const mergedKeys = new Set([existing.normalized_name, ...merged.map(normalizeText)]);
      for (const a of [name, ...aliases]) {
        const key = normalizeText(a);
        if (!mergedKeys.has(key)) { merged.push(a); mergedKeys.add(key); }
      }
      toUpdate.push({
        row,
        node: String(existing.id),
        parents,
        existing,
        values: {
          id: existing.id,
          name: existing.name,
          default_unit: defaultUnit,
          allergen_group_id: allergenGroupId,
          aliases: merged,
          is_common: isCommon ?? existing.is_common,
          needs_review: false,
        },
      });
    }
  }

  // Nhóm nguyên liệu: nguyên liệu gốc phải đã có hoặc nằm trong cùng file, và không tạo vòng (A thuộc B, B thuộc A).
  // Dòng có nhóm lỗi bị loại; lặp lại vì dòng khác có thể đang dùng dòng vừa bị loại làm nguyên liệu gốc.
  const nodeOfKey = (k) => {
    const ing = existingByKey.get(k);
    if (ing) return String(ing.id);
    return rowByKey.has(k) ? rowNode.get(rowByKey.get(k)) ?? null : null;
  };
  const baseParents = new Map();
  for (const l of linkRes.data || []) {
    const id = String(l.ingredient_id);
    if (!baseParents.has(id)) baseParents.set(id, []);
    baseParents.get(id).push(String(l.parent_id));
  }
  for (let changed = true; changed;) {
    changed = false;
    const entries = [...toCreate, ...toUpdate];
    const graph = new Map(baseParents);
    const failed = new Map();
    for (const e of entries.filter((x) => x.parents.length)) {
      e.parentNodes = [];
      for (const p of e.parents) {
        const node = nodeOfKey(p.key);
        if (node) { if (!e.parentNodes.includes(node)) e.parentNodes.push(node); } else failed.set(e, { code: 'PARENT_NOT_FOUND', message: `Không tìm thấy nguyên liệu gốc "${p.name}".` });
      }
      graph.set(e.node, e.parentNodes);
    }
    for (const e of entries.filter((x) => x.parents.length && !failed.has(x))) {
      const seen = new Set();
      const stack = [...e.parentNodes];
      while (stack.length) {
        const n = stack.pop();
        if (n === e.node) {
          failed.set(e, { code: 'PARENT_CYCLE', message: 'Nhóm nguyên liệu tạo vòng lặp (nguyên liệu gốc lại thuộc nhóm của nguyên liệu này).' });
          break;
        }
        if (!seen.has(n)) { seen.add(n); stack.push(...(graph.get(n) || [])); }
      }
    }
    for (const [e, { code, message }] of failed) {
      errors.push({ row: e.row, field: 'parent_names', code, message });
      rowNode.delete(e.row);
      changed = true;
    }
    toCreate = toCreate.filter((e) => !failed.has(e));
    toUpdate = toUpdate.filter((e) => !failed.has(e));
  }
  const groupedCount = [...toCreate, ...toUpdate].filter((e) => e.parents.length).length;

  const result = {
    dry_run: dryRun,
    file_name: req.file.originalname,
    total_rows: dataRows.length,
    created_count: toCreate.length,
    updated_count: toUpdate.length,
    grouped_count: groupedCount,
    skipped,
    errors,
    warnings,
  };
  if (dryRun) return sendOk(res, result);

  if (toCreate.length + toUpdate.length + skipped.length === 0) {
    return sendError(res, 422, 'NO_VALID_ROWS', 'Không có dòng hợp lệ nào để lưu.', errors);
  }

  // Thêm mới trong một câu lệnh; cập nhật trong một câu lệnh. Cập nhật lỗi thì xóa các nguyên liệu vừa tạo.
  let created = [];
  if (toCreate.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('ingredients')
      .insert(toCreate.map((e) => ({ ...e.values, needs_review: false, created_by: req.user.id })))
      .select('id, name');
    if (error) {
      console.error('[Import] Lỗi thêm nguyên liệu:', error);
      return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi dữ liệu; không nguyên liệu nào được lưu.');
    }
    created = data;
  }
  if (toUpdate.length > 0) {
    const { error } = await supabaseAdmin.from('ingredients').upsert(toUpdate.map((u) => u.values), { onConflict: 'id' });
    if (error) {
      if (created.length > 0) await supabaseAdmin.from('ingredients').delete().in('id', created.map((c) => c.id));
      console.error('[Import] Lỗi cập nhật nguyên liệu, đã hoàn tác:', error);
      return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi dữ liệu; đã hoàn tác, không nguyên liệu nào được lưu.');
    }
  }

  // Nhóm nguyên liệu: dòng cập nhật có parent_names thì thay toàn bộ nhóm cũ; để trống thì giữ nguyên
  const grouped = [...toCreate, ...toUpdate].filter((e) => e.parents.length);
  if (grouped.length > 0) {
    const createdIdByName = new Map(created.map((c) => [normalizeText(c.name), Number(c.id)]));
    const idOfNode = new Map(toCreate.map((e) => [e.node, createdIdByName.get(normalizeText(e.values.name))]));
    const resolve = (node) => (node.startsWith('new:') ? idOfNode.get(node) : Number(node));
    const replacedIds = toUpdate.filter((e) => e.parents.length).map((e) => Number(e.existing.id));
    let linkError = null;
    if (replacedIds.length > 0) {
      ({ error: linkError } = await supabaseAdmin.from('ingredient_parents').delete().in('ingredient_id', replacedIds));
    }
    if (!linkError) {
      const links = grouped.flatMap((e) => e.parentNodes.map((p) => ({ ingredient_id: resolve(e.node), parent_id: resolve(p) })));
      ({ error: linkError } = await supabaseAdmin.from('ingredient_parents').insert(links));
    }
    if (linkError) {
      if (created.length > 0) await supabaseAdmin.from('ingredients').delete().in('id', created.map((c) => c.id));
      console.error('[Import] Lỗi ghi nhóm nguyên liệu:', linkError);
      return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi nhóm nguyên liệu; đã hoàn tác nguyên liệu mới. Nguyên liệu cập nhật có thể đã mất nhóm cũ, hãy nhập lại file.');
    }
  }

  // Nhóm dị ứng hoặc nhóm nguyên liệu thay đổi thì các gợi ý đã lưu đệm không còn đúng (luồng 2c)
  if (grouped.length > 0 || toUpdate.some((u) => (u.existing.allergen_group_id ?? null) !== (u.values.allergen_group_id ?? null))) {
    clearRecommendationCache();
  }

  recordAuditLog(req.user, 'ingredient.import', 'ingredient', null, {
    file_name: req.file.originalname,
    on_duplicate: onDuplicate,
    total_rows: dataRows.length,
    created_ids: created.map((c) => Number(c.id)),
    updated_ids: toUpdate.map((u) => Number(u.existing.id)),
    grouped_count: grouped.length,
    skipped_count: skipped.length,
  });

  return sendOk(res, result, { status: created.length > 0 ? 201 : 200 });
}
