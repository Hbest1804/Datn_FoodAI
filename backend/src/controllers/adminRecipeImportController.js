// src/controllers/adminRecipeImportController.js
// Admin – Nhập công thức (nguyên liệu và các bước) cho nhiều món đã có từ file Excel (mục 4.14.5 – 4.14.6, UC16 luồng 2a).

import { supabaseAdmin } from '../config/supabase.js';
import { recordAuditLog } from '../services/auditService.js';
import { reindexDishInBackground } from '../services/embeddingService.js';
import { buildXlsx, fileExtension, parseFlag, parseTable, readImportSheets, XLSX_MIME } from '../utils/importFile.js';
import { normalizeText, slugify } from '../utils/textUtils.js';
import { parseBool, sendError, sendOk } from '../utils/http.js';

const SHEET_INGREDIENTS = 'nguyen_lieu_mon';
const SHEET_STEPS = 'buoc_che_bien';
const INGREDIENT_COLUMNS = ['slug', 'ingredient', 'quantity', 'unit', 'is_optional'];
const STEP_COLUMNS = ['slug', 'step_order', 'content'];
const MAX_RECIPE_ROWS = 5000;
const SHEET_ORDER = [SHEET_INGREDIENTS, SHEET_STEPS];

/**
 * 4.14.5 Tải file mẫu nhập công thức – GET /admin/recipes/import/template (chỉ .xlsx vì cần hai sheet)
 */
export async function adminGetRecipeImportTemplate(req, res) {
  const { data: dishes, error } = await supabaseAdmin
    .from('dishes')
    .select('slug, name, recipe_steps(count), dish_ingredients(count)')
    .order('name');
  if (error) throw error;
  const list = (dishes || []).map((d) => ({
    slug: d.slug,
    name: d.name,
    hasRecipe: (d.recipe_steps?.[0]?.count || 0) > 0 || (d.dish_ingredients?.[0]?.count || 0) > 0,
  }));
  // Ví dụ dùng món đầu tiên chưa có công thức để file mẫu gần với dữ liệu thật
  const sample = (list.find((d) => !d.hasRecipe) || list[0] || { slug: 'bun-bo-hue' }).slug;

  const guide = [
    ['Sheet', 'Cột', 'Bắt buộc', 'Mô tả'],
    [SHEET_INGREDIENTS, 'slug', 'Có', 'Mã món đã có trong hệ thống (xem danh sách bên dưới).'],
    [SHEET_INGREDIENTS, 'ingredient', 'Có', 'Tên nguyên liệu (tên chuẩn hoặc tên gọi khác). Nguyên liệu chưa có sẽ được tạo mới.'],
    [SHEET_INGREDIENTS, 'quantity', 'Có', 'Số lượng, lớn hơn 0, tối đa 2 chữ số thập phân.'],
    [SHEET_INGREDIENTS, 'unit', 'Không', 'Đơn vị; để trống thì dùng đơn vị mặc định của nguyên liệu (nguyên liệu mới: g).'],
    [SHEET_INGREDIENTS, 'is_optional', 'Không', 'Nguyên liệu tùy chọn: true/false hoặc có/không (mặc định false).'],
    [SHEET_STEPS, 'slug', 'Có', 'Mã món đã có trong hệ thống.'],
    [SHEET_STEPS, 'step_order', 'Có', 'Thứ tự bước, số nguyên dương, không trùng trong cùng món.'],
    [SHEET_STEPS, 'content', 'Có', 'Nội dung bước.'],
    [],
    ['Mỗi món trong file phải có cả nguyên liệu lẫn bước chế biến. Mỗi sheet tối đa 5.000 dòng.'],
    [],
    ['Món hiện có', 'slug', 'Đã có công thức'],
    ...list.map((d) => [d.name, d.slug, d.hasRecipe ? 'Có' : 'Chưa']),
  ];

  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-cong-thuc.xlsx"');
  return res.send(buildXlsx([
    {
      name: SHEET_INGREDIENTS,
      rows: [INGREDIENT_COLUMNS, [sample, 'Thịt bò', 500, 'g', 'false'], [sample, 'Hành lá', 3, 'nhánh', 'false'], [sample, 'Ớt', 2, 'quả', 'true']],
      cols: [22, 20, 10, 12, 12],
    },
    {
      name: SHEET_STEPS,
      rows: [STEP_COLUMNS, [sample, 1, 'Sơ chế nguyên liệu, thái thịt bò mỏng.'], [sample, 2, 'Nấu nước dùng và nêm vừa ăn.'], [sample, 3, 'Trình bày ra bát, rắc hành lá và ớt.']],
      cols: [22, 12, 80],
    },
    { name: 'Huong_dan', rows: guide, cols: [36, 22, 16, 90] },
  ]));
}

/** Đọc file: cần đủ hai sheet nguyen_lieu_mon và buoc_che_bien. */
function readRecipeFile(file) {
  const book = readImportSheets(file);
  const missing = SHEET_ORDER.filter((name) => !book.sheets.has(name));
  if (missing.length) {
    throw { status: 422, code: 'INVALID_TEMPLATE', message: `File thiếu sheet ${missing.map((m) => `"${m}"`).join(', ')}. Hãy tải lại file mẫu.` };
  }
  const ingredients = parseTable(book.sheets.get(SHEET_INGREDIENTS), {
    columns: INGREDIENT_COLUMNS, required: ['slug', 'ingredient', 'quantity'], label: SHEET_INGREDIENTS,
  });
  const steps = parseTable(book.sheets.get(SHEET_STEPS), {
    columns: STEP_COLUMNS, required: ['slug', 'step_order', 'content'], label: SHEET_STEPS,
  });
  if (ingredients.data.length === 0 && steps.data.length === 0) {
    throw { status: 422, code: 'EMPTY_FILE', message: 'File không có dòng dữ liệu nào.' };
  }
  for (const [name, sheet] of [[SHEET_INGREDIENTS, ingredients], [SHEET_STEPS, steps]]) {
    if (sheet.data.length > MAX_RECIPE_ROWS) {
      throw { status: 422, code: 'TOO_MANY_ROWS', message: `Sheet ${name} có ${sheet.data.length} dòng, tối đa ${MAX_RECIPE_ROWS} dòng.` };
    }
  }
  return { ingredients, steps };
}

/** Kiểm tra toàn bộ file theo từng món (không ghi CSDL). */
async function validateRecipeImport({ ingredients, steps }) {
  const [dishRes, ingRes] = await Promise.all([
    supabaseAdmin.from('dishes').select('id, name, slug, is_published, recipe_steps(count), dish_ingredients(count)'),
    supabaseAdmin.from('ingredients').select('id, name, normalized_name, aliases, default_unit'),
  ]);
  if (dishRes.error) throw dishRes.error;
  if (ingRes.error) throw ingRes.error;
  const dishBySlug = new Map((dishRes.data || []).map((d) => [d.slug, d]));
  const ingredientByName = new Map();
  for (const i of ingRes.data || []) ingredientByName.set(i.normalized_name, i);
  for (const i of ingRes.data || []) {
    (i.aliases || []).forEach((a) => { if (!ingredientByName.has(normalizeText(a))) ingredientByName.set(normalizeText(a), i); });
  }

  const errors = [];
  const entries = new Map(); // dish id → công thức gom từ file

  const lineOf = (sheet, { row, obj }) => {
    const raw = String(obj.slug ?? '').trim();
    const dish = raw ? dishBySlug.get(slugify(raw)) : null;
    let entry = null;
    if (dish) {
      if (!entries.has(dish.id)) {
        entries.set(dish.id, {
          dish,
          hasExisting: (dish.recipe_steps?.[0]?.count || 0) > 0 || (dish.dish_ingredients?.[0]?.count || 0) > 0,
          errors: 0,
          ingredients: [],
          steps: [],
          firstRow: { [SHEET_INGREDIENTS]: null, [SHEET_STEPS]: null },
        });
      }
      entry = entries.get(dish.id);
      entry.firstRow[sheet] ??= row;
    }
    const err = (field, code, message) => {
      if (entry) entry.errors++;
      errors.push({ sheet, row, slug: dish ? dish.slug : raw || null, field, code, message });
    };
    if (!raw) err('slug', 'REQUIRED', 'Thiếu mã món (slug).');
    else if (!dish) err('slug', 'DISH_REF_NOT_FOUND', `Không có món mang slug "${raw}" trong hệ thống.`);
    return { entry, err, text: (k) => String(obj[k] ?? '').trim() };
  };

  for (const line of ingredients.data) {
    const { entry, err, text } = lineOf(SHEET_INGREDIENTS, line);
    const name = text('ingredient').replace(/\s+/g, ' ');
    if (!name) err('ingredient', 'REQUIRED', 'Thiếu tên nguyên liệu.');
    else if (name.length > 100) err('ingredient', 'INVALID_VALUE', 'Tên nguyên liệu tối đa 100 ký tự.');
    const qtyRaw = text('quantity');
    const quantity = Number(qtyRaw);
    if (!qtyRaw) err('quantity', 'REQUIRED', 'Thiếu số lượng.');
    else if (!Number.isFinite(quantity) || quantity <= 0 || quantity >= 1e8 || Math.abs(Math.round(quantity * 100) - quantity * 100) > 1e-6) {
      err('quantity', 'INVALID_VALUE', 'Số lượng phải lớn hơn 0, tối đa 2 chữ số thập phân.');
    }
    const optional = parseFlag(text('is_optional'));
    if (optional === undefined) err('is_optional', 'INVALID_VALUE', 'is_optional chỉ nhận true/false hoặc có/không.');
    if (!entry || !name || name.length > 100) continue;
    // Nguyên liệu chưa có trong danh mục được tạo mới khi lưu (như khi thêm nguyên liệu mới trong biểu mẫu công thức)
    const ingredient = ingredientByName.get(normalizeText(name));
    const key = ingredient ? `id:${ingredient.id}` : `new:${normalizeText(name)}`;
    if (entry.ingredients.some((i) => i.key === key)) {
      err('ingredient', 'DUPLICATE_INGREDIENT', `Nguyên liệu "${ingredient ? ingredient.name : name}" bị lặp lại trong cùng món.`);
      continue;
    }
    entry.ingredients.push({
      key,
      ingredient_id: ingredient ? Number(ingredient.id) : null,
      name,
      quantity,
      unit: text('unit') || ingredient?.default_unit || 'g',
      is_optional: optional === true,
    });
  }

  for (const line of steps.data) {
    const { entry, err, text } = lineOf(SHEET_STEPS, line);
    const orderRaw = text('step_order');
    const order = Number(orderRaw);
    const content = text('content');
    if (!orderRaw) err('step_order', 'REQUIRED', 'Thiếu thứ tự bước.');
    else if (!Number.isInteger(order) || order < 1 || order > 32767) err('step_order', 'INVALID_VALUE', 'Thứ tự bước phải là số nguyên dương.');
    else if (entry?.steps.some((s) => s.order === order)) err('step_order', 'DUPLICATE_STEP_ORDER', `Bước ${order} bị trùng trong cùng món.`);
    if (!content) err('content', 'REQUIRED', 'Nội dung bước không được để trống.');
    if (entry && Number.isInteger(order) && order >= 1 && content) entry.steps.push({ order, content });
  }

  // Mỗi món phải có cả nguyên liệu lẫn bước
  for (const entry of entries.values()) {
    const hasIng = entry.firstRow[SHEET_INGREDIENTS] !== null;
    const hasStep = entry.firstRow[SHEET_STEPS] !== null;
    if (hasIng !== hasStep) {
      entry.errors++;
      const sheet = hasIng ? SHEET_INGREDIENTS : SHEET_STEPS;
      errors.push({
        sheet, row: entry.firstRow[sheet], slug: entry.dish.slug, field: 'slug', code: 'RECIPE_INCOMPLETE',
        message: hasIng ? `Món có nguyên liệu nhưng chưa có bước chế biến ở sheet ${SHEET_STEPS}.` : `Món có bước chế biến nhưng chưa có nguyên liệu ở sheet ${SHEET_INGREDIENTS}.`,
      });
    }
    // Bước được đánh số lại liên tục từ 1 theo step_order, như khi lưu công thức thủ công
    entry.steps.sort((a, b) => a.order - b.order).forEach((s, idx) => { s.order = idx + 1; });
  }
  errors.sort((a, b) => SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet) || a.row - b.row);

  const all = [...entries.values()];
  return { all, valid: all.filter((e) => e.errors === 0), errors };
}

/** Ghi đè công thức của một món: ghi dòng mới rồi xóa dòng thừa để công thức không lúc nào rỗng (món đang hiển thị). */
async function overwriteRecipe(dishId, ingRows, stepRows) {
  if (ingRows.length > 0) {
    const { error } = await supabaseAdmin.from('dish_ingredients').upsert(ingRows, { onConflict: 'dish_id,ingredient_id' });
    if (error) throw error;
  }
  let prune = supabaseAdmin.from('dish_ingredients').delete().eq('dish_id', dishId);
  if (ingRows.length > 0) prune = prune.not('ingredient_id', 'in', `(${ingRows.map((r) => r.ingredient_id).join(',')})`);
  const { error: pruneIngErr } = await prune;
  if (pruneIngErr) throw pruneIngErr;

  if (stepRows.length > 0) {
    const { error } = await supabaseAdmin.from('recipe_steps').upsert(stepRows, { onConflict: 'dish_id,step_order' });
    if (error) throw error;
  }
  const { error: pruneStepErr } = await supabaseAdmin.from('recipe_steps').delete().eq('dish_id', dishId).gt('step_order', stepRows.length);
  if (pruneStepErr) throw pruneStepErr;
}

const toRows = (entry, newIds) => ({
  ingRows: entry.ingredients.map((i) => ({
    dish_id: entry.dish.id,
    ingredient_id: i.ingredient_id ?? newIds.get(i.key),
    quantity: i.quantity,
    unit: i.unit,
    is_optional: i.is_optional,
  })),
  stepRows: entry.steps.map((s) => ({ dish_id: entry.dish.id, step_order: s.order, content: s.content })),
});

/** Nguyên liệu mới cần tạo cho các món sẽ lưu: khóa đã chuẩn hóa → tên và đơn vị mặc định (lấy từ dòng đầu tiên). */
function collectNewIngredients(entries) {
  const pending = new Map();
  for (const e of entries) {
    for (const i of e.ingredients) {
      if (i.ingredient_id === null && !pending.has(i.key)) pending.set(i.key, { name: i.name, default_unit: i.unit });
    }
  }
  return pending;
}

/**
 * Ghi công thức của các món: tạo nguyên liệu mới → món chưa có công thức ghi theo lô → món ghi đè
 * (lưu bản cũ trước để khôi phục) → công khai. Supabase không hỗ trợ giao dịch nhiều câu lệnh nên lỗi ở bước nào
 * cũng hoàn tác phần đã ghi, kể cả nguyên liệu vừa tạo.
 */
async function writeRecipes(toCreate, toReplace, publishIds, pendingNew, userId) {
  const createIds = toCreate.map((e) => e.dish.id);
  const replaceIds = toReplace.map((e) => e.dish.id);
  const snapshot = new Map(replaceIds.map((id) => [id, { ingRows: [], stepRows: [] }]));
  if (replaceIds.length > 0) {
    const [oldIngs, oldSteps] = await Promise.all([
      supabaseAdmin.from('dish_ingredients').select('dish_id, ingredient_id, quantity, unit, is_optional').in('dish_id', replaceIds),
      supabaseAdmin.from('recipe_steps').select('dish_id, step_order, content').in('dish_id', replaceIds),
    ]);
    if (oldIngs.error) throw oldIngs.error;
    if (oldSteps.error) throw oldSteps.error;
    (oldIngs.data || []).forEach((r) => snapshot.get(r.dish_id).ingRows.push(r));
    (oldSteps.data || []).forEach((r) => snapshot.get(r.dish_id).stepRows.push(r));
  }

  const replaced = [];
  let createdIngredients = [];
  try {
    if (pendingNew.size > 0) {
      const { data, error } = await supabaseAdmin
        .from('ingredients')
        .insert([...pendingNew.values()].map((n) => ({ ...n, needs_review: false, created_by: userId })))
        .select('id, name');
      if (error) throw error;
      createdIngredients = data;
    }
    const newIds = new Map(createdIngredients.map((i) => [`new:${normalizeText(i.name)}`, Number(i.id)]));

    const created = toCreate.map((e) => toRows(e, newIds));
    for (const [table, rows] of [['dish_ingredients', created.flatMap((c) => c.ingRows)], ['recipe_steps', created.flatMap((c) => c.stepRows)]]) {
      if (rows.length === 0) continue;
      const { error } = await supabaseAdmin.from(table).insert(rows);
      if (error) throw error;
    }
    for (const entry of toReplace) {
      replaced.push(entry.dish.id);
      const { ingRows, stepRows } = toRows(entry, newIds);
      await overwriteRecipe(entry.dish.id, ingRows, stepRows);
    }
    if (publishIds.length > 0) {
      const { error } = await supabaseAdmin.from('dishes').update({ is_published: true }).in('id', publishIds);
      if (error) throw error;
    }
  } catch (err) {
    // Hoàn tác: xóa công thức vừa thêm (các món này chưa công khai) và khôi phục công thức cũ của món đã ghi đè
    try {
      if (createIds.length > 0) {
        await supabaseAdmin.from('dish_ingredients').delete().in('dish_id', createIds);
        await supabaseAdmin.from('recipe_steps').delete().in('dish_id', createIds);
      }
      for (const id of replaced) {
        const old = snapshot.get(id);
        await overwriteRecipe(id, old.ingRows, [...old.stepRows].sort((a, b) => a.step_order - b.step_order));
      }
      if (createdIngredients.length > 0) {
        await supabaseAdmin.from('ingredients').delete().in('id', createdIngredients.map((i) => i.id));
      }
    } catch (rollbackErr) {
      console.error('[Import] Hoàn tác công thức thất bại:', rollbackErr);
    }
    throw err;
  }
  return createdIngredients;
}

/**
 * 4.14.6 Nhập công thức từ file Excel – POST /admin/recipes/import (biểu mẫu: file, dry_run, on_existing, publish)
 */
export async function adminImportRecipes(req, res) {
  if (!req.file) return sendError(res, 400, 'FILE_REQUIRED', 'Thiếu trường file.');
  if (fileExtension(req.file) !== 'xlsx') {
    return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Công thức chỉ nhập được bằng file .xlsx (gồm hai sheet nguyên liệu và bước chế biến).');
  }
  const dryRun = req.body?.dry_run === undefined || req.body.dry_run === '' ? true : parseBool(req.body.dry_run);
  if (dryRun === undefined) return sendError(res, 422, 'VALIDATION_ERROR', 'dry_run phải là true hoặc false.');
  const onExisting = req.body?.on_existing || 'skip';
  if (!['skip', 'replace'].includes(onExisting)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'on_existing phải là skip hoặc replace.');
  }
  const publish = req.body?.publish === undefined || req.body.publish === '' ? false : parseBool(req.body.publish);
  if (publish === undefined) return sendError(res, 422, 'VALIDATION_ERROR', 'publish phải là true hoặc false.');

  let file;
  try {
    file = readRecipeFile(req.file);
  } catch (err) {
    if (err.code) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
  const warnings = [...file.ingredients.warnings, ...file.steps.warnings];

  const { all, valid, errors } = await validateRecipeImport(file);
  const toCreate = valid.filter((e) => !e.hasExisting);
  const toReplace = onExisting === 'replace' ? valid.filter((e) => e.hasExisting) : [];
  const skipped = onExisting === 'skip'
    ? valid.filter((e) => e.hasExisting).map((e) => ({ slug: e.dish.slug, dish_id: e.dish.id, name: e.dish.name }))
    : [];
  const saving = [...toCreate, ...toReplace];
  const publishIds = publish ? saving.filter((e) => !e.dish.is_published).map((e) => e.dish.id) : [];
  const pendingNew = collectNewIngredients(saving);

  const result = {
    dry_run: dryRun,
    file_name: req.file.originalname,
    total_dishes: all.length,
    valid_dishes: valid.length,
    error_dishes: all.length - valid.length,
    created_count: toCreate.length,
    replaced_count: toReplace.length,
    published_count: publishIds.length,
    new_ingredients: [...pendingNew.values()].map((n) => n.name),
    skipped,
    errors,
    warnings,
  };
  if (dryRun) return sendOk(res, result);

  if (valid.length === 0) return sendError(res, 422, 'NO_VALID_ROWS', 'Không có món hợp lệ nào để lưu.', errors);
  if (saving.length === 0) return sendOk(res, { ...result, saved: [] });

  let createdIngredients;
  try {
    createdIngredients = await writeRecipes(toCreate, toReplace, publishIds, pendingNew, req.user.id);
  } catch (err) {
    console.error('[Import] Lỗi ghi công thức, đã hoàn tác:', err);
    return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi dữ liệu; đã hoàn tác, không công thức nào được lưu.');
  }

  saving.forEach((e) => reindexDishInBackground(e.dish.id));
  recordAuditLog(req.user, 'recipe.import', 'dish', null, {
    file_name: req.file.originalname,
    on_existing: onExisting,
    publish,
    created_ids: toCreate.map((e) => e.dish.id),
    replaced_ids: toReplace.map((e) => e.dish.id),
    published_ids: publishIds,
    new_ingredient_ids: createdIngredients.map((i) => Number(i.id)),
    skipped_count: skipped.length,
  });

  return sendOk(res, {
    ...result,
    saved: saving.map((e) => ({
      dish_id: e.dish.id,
      name: e.dish.name,
      slug: e.dish.slug,
      replaced: e.hasExisting,
      is_published: e.dish.is_published || publishIds.includes(e.dish.id),
    })),
  }, { status: 200 });
}
