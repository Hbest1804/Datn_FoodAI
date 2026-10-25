// src/controllers/adminDishesController.js
// Admin – Quản lý món ăn (mục 4.10, 5.7) và công thức (mục 4.14). Mọi API yêu cầu vai trò admin.

import { supabaseAdmin } from '../config/supabase.js';
import { recordAuditLog } from '../services/auditService.js';
import { reindexDish, reindexDishInBackground } from '../services/embeddingService.js';
import { inspectImage } from '../utils/image.js';
import { importRemoteDishImage, isOwnDishImageUrl, removeDishImages, uploadDishImage } from '../services/imageStorageService.js';
import { buildCsvTemplate, buildXlsx, fileExtension, parseTable, readImportFile, XLSX_MIME } from '../utils/importFile.js';
import { matchesSearchKeyword, normalizeText, slugify } from '../utils/textUtils.js';
import {
  pageMeta,
  parseBool,
  parsePagination,
  requireConfirm,
  sendError,
  sendOk,
} from '../utils/http.js';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const NUMERIC_FIELDS = ['cook_time_minutes', 'est_cost', 'calories', 'protein_g', 'carbs_g', 'fat_g'];
const DISH_COLUMNS = 'id, slug, created_by, created_at, updated_at, name, description, image_url, category, cook_time_minutes, difficulty, servings, est_cost, calories, protein_g, carbs_g, fat_g, is_published';

function dishNotFound(res) {
  return sendError(res, 404, 'DISH_NOT_FOUND', 'Món không tồn tại.');
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const toNum = (v) => (v === null || v === undefined ? null : Number(v));

/** Món có công thức khi có ít nhất 1 nguyên liệu và 1 bước (khớp trigger check_published_has_recipe). */
async function getRecipeCounts(dishId) {
  const [ings, steps] = await Promise.all([
    supabaseAdmin.from('dish_ingredients').select('*', { count: 'exact', head: true }).eq('dish_id', dishId),
    supabaseAdmin.from('recipe_steps').select('*', { count: 'exact', head: true }).eq('dish_id', dishId),
  ]);
  return { ingredients: ings.count || 0, steps: steps.count || 0 };
}

async function loadDish(dishId) {
  const { data, error } = await supabaseAdmin
    .from('dishes')
    .select(`${DISH_COLUMNS}, dish_tags(tag_id)`)
    .eq('id', dishId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function formatDish(dish) {
  const counts = await getRecipeCounts(dish.id);
  const { dish_tags: tags, ...rest } = dish;
  return {
    ...rest,
    est_cost: toNum(rest.est_cost),
    calories: toNum(rest.calories),
    protein_g: toNum(rest.protein_g),
    carbs_g: toNum(rest.carbs_g),
    fat_g: toNum(rest.fat_g),
    tag_ids: (tags || []).map((t) => t.tag_id),
    has_recipe: counts.ingredients > 0 && counts.steps > 0,
  };
}

/** Dùng lại cách viết danh mục đã có nếu trùng (không phân biệt hoa thường, dấu) – quy tắc 3 mục 4.10.3. */
async function loadCategoryMap() {
  const { data, error } = await supabaseAdmin.from('dishes').select('category, category_normalized');
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((d) => { if (!map.has(d.category_normalized)) map.set(d.category_normalized, d.category); });
  return map;
}

/**
 * Kiểm tra dữ liệu món khi thêm/sửa. `existing` khác null nghĩa là đang sửa: trường không gửi thì giữ nguyên.
 * Trả về danh sách lỗi theo trường, các giá trị đã làm sạch và danh sách id thẻ.
 */
async function validateDishBody(body, existing = null) {
  const details = [];
  const add = (field, code, message) => details.push({ field, code, message });
  const values = {};
  const has = (k) => body[k] !== undefined;

  // Tên (bắt buộc)
  if (!existing || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) add('name', 'REQUIRED', 'Tên món là bắt buộc.');
    else if (name.length > 200) add('name', 'TOO_LONG', 'Tên món tối đa 200 ký tự.');
    else values.name = name;
  }

  // Danh mục (bắt buộc, văn bản Admin tự nhập); chấp nhận khóa cũ category_name
  const rawCategory = body.category ?? body.category_name;
  if (!existing || rawCategory !== undefined) {
    const category = typeof rawCategory === 'string' ? rawCategory.trim().replace(/\s+/g, ' ') : '';
    if (!category) add('category', 'REQUIRED', 'Danh mục món là bắt buộc.');
    else if (category.length > 100) add('category', 'CATEGORY_TOO_LONG', 'Danh mục tối đa 100 ký tự.');
    else values.category = (await loadCategoryMap()).get(normalizeText(category)) || category;
  }

  // Khẩu phần (bắt buộc)
  if (!existing || has('servings')) {
    const servings = Number(body.servings);
    if (!Number.isInteger(servings) || servings < 1) add('servings', 'INVALID_VALUE', 'Số khẩu phần là số nguyên lớn hơn 0.');
    else values.servings = servings;
  }

  if (has('description')) values.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;

  if (has('image_url')) {
    if (body.image_url === null || body.image_url === '') values.image_url = null;
    else if (typeof body.image_url !== 'string' || !isHttpUrl(body.image_url.trim())) add('image_url', 'INVALID_URL', 'URL ảnh không hợp lệ.');
    else values.image_url = body.image_url.trim();
  }

  if (has('difficulty')) {
    if (body.difficulty === null || body.difficulty === '') values.difficulty = null;
    else if (!DIFFICULTIES.includes(body.difficulty)) add('difficulty', 'INVALID_VALUE', 'Độ khó: easy | medium | hard.');
    else values.difficulty = body.difficulty;
  }

  for (const f of NUMERIC_FIELDS) {
    if (!has(f)) continue;
    if (body[f] === null || body[f] === '') { values[f] = null; continue; }
    const n = Number(body[f]);
    const min = f === 'cook_time_minutes' ? 1 : 0;
    if (!Number.isFinite(n) || n < min) add(f, 'INVALID_VALUE', `${f} phải là số ${min > 0 ? 'lớn hơn 0' : 'không âm'}.`);
    else values[f] = n;
  }

  if (existing && has('is_published')) {
    const pub = parseBool(body.is_published);
    if (pub === undefined) add('is_published', 'INVALID_VALUE', 'is_published phải là boolean.');
    else values.is_published = pub;
  }

  // Thẻ: phải tồn tại trong bảng tags (dữ liệu khởi tạo sẵn)
  let tagIds;
  if (has('tag_ids')) {
    const ids = Array.isArray(body.tag_ids) ? body.tag_ids.map(Number) : null;
    if (!ids || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      add('tag_ids', 'INVALID_VALUE', 'tag_ids phải là mảng id thẻ.');
    } else {
      tagIds = [...new Set(ids)];
      if (tagIds.length > 0) {
        const { data } = await supabaseAdmin.from('tags').select('id').in('id', tagIds);
        const found = new Set((data || []).map((t) => t.id));
        const missing = tagIds.filter((id) => !found.has(id));
        if (missing.length) add('tag_ids', 'TAG_NOT_FOUND', `Thẻ không tồn tại: ${missing.join(', ')}`);
      }
    }
  }

  return { details, values, tagIds };
}

/** Tên hoặc slug trùng món khác → true. */
async function isNameTaken(name, excludeId = null) {
  const slug = slugify(name);
  let query = supabaseAdmin.from('dishes').select('id, name').eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query;
  return (data || []).length > 0;
}

async function replaceTags(dishId, tagIds) {
  const { error: delErr } = await supabaseAdmin.from('dish_tags').delete().eq('dish_id', dishId);
  if (delErr) throw delErr;
  if (tagIds.length > 0) {
    const { error } = await supabaseAdmin.from('dish_tags').insert(tagIds.map((tag_id) => ({ dish_id: dishId, tag_id })));
    if (error) throw error;
  }
}

// ── 4.10.1 – 4.10.5 Món ăn ──────────────────────────────────────────────────

/**
 * 4.10.1 Danh sách món (quản trị) – GET /admin/dishes?q=&is_published=&category=&sort=&page=&limit=
 */
export async function adminGetDishes(req, res) {
  const pg = parsePagination(req.query);
  const sort = req.query.sort ?? 'updated_at';
  if (!['updated_at', 'created_at', 'name'].includes(sort)) {
    return sendError(res, 400, 'INVALID_QUERY', 'sort phải là updated_at, created_at hoặc name.');
  }
  const isPublished = req.query.is_published === undefined || req.query.is_published === '' ? undefined : parseBool(req.query.is_published);
  if (req.query.is_published && isPublished === undefined) {
    return sendError(res, 400, 'INVALID_QUERY', 'is_published phải là true hoặc false.');
  }

  let query = supabaseAdmin
    .from('dishes')
    .select(`id, name, slug, description, image_url, category, cook_time_minutes, difficulty, servings, calories,
      protein_g, carbs_g, fat_g, avg_rating, rating_count, favorite_count, is_published, created_at, updated_at,
      recipe_steps(count), dish_ingredients(count)`);
  if (isPublished !== undefined) query = query.eq('is_published', isPublished);
  if (typeof req.query.category === 'string' && req.query.category.trim()) {
    query = query.eq('category_normalized', normalizeText(req.query.category));
  }
  query = sort === 'name' ? query.order('name') : query.order(sort, { ascending: false });
  const { data, error } = await query;
  if (error) throw error;

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = (data || []).filter((d) => !q || matchesSearchKeyword(d.name, q));
  const items = rows.slice(pg.from, pg.to + 1).map(({ recipe_steps: steps, dish_ingredients: ings, ...d }) => {
    const ingredientCount = ings?.[0]?.count || 0;
    const stepCount = steps?.[0]?.count || 0;
    return {
      ...d,
      calories: toNum(d.calories),
      protein_g: toNum(d.protein_g),
      carbs_g: toNum(d.carbs_g),
      fat_g: toNum(d.fat_g),
      avg_rating: Number(d.avg_rating) || 0,
      ingredient_count: ingredientCount,
      step_count: stepCount,
      has_recipe: stepCount > 0 && ingredientCount > 0,
    };
  });
  return sendOk(res, items, { meta: pageMeta(pg, rows.length) });
}

/**
 * 4.10.2 Chi tiết món (quản trị) – GET /admin/dishes/:dishId
 */
export async function adminGetDishDetail(req, res) {
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);
  return sendOk(res, await formatDish(dish));
}

/**
 * 4.10.3 Thêm món ăn – POST /admin/dishes. Món mới luôn ẩn vì chưa có công thức.
 */
export async function adminCreateDish(req, res) {
  const { details, values, tagIds } = await validateDishBody(req.body || {});
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu món không hợp lệ.', details);
  if (await isNameTaken(values.name)) {
    return sendError(res, 409, 'DISH_NAME_EXISTS', 'Tên món hoặc slug đã tồn tại.');
  }

  const { data: created, error } = await supabaseAdmin
    .from('dishes')
    .insert({ ...values, slug: slugify(values.name), is_published: false, created_by: req.user.id })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return sendError(res, 409, 'DISH_NAME_EXISTS', 'Tên món hoặc slug đã tồn tại.');
    throw error;
  }
  if (tagIds?.length) await replaceTags(created.id, tagIds);

  reindexDishInBackground(created.id);
  recordAuditLog(req.user, 'dish.create', 'dish', created.id, { name: values.name });
  return sendOk(res, await formatDish(await loadDish(created.id)), { status: 201 });
}

/**
 * 4.10.4 Sửa món ăn – PUT /admin/dishes/:dishId. tag_ids gửi lên thay thế hoàn toàn.
 */
export async function adminUpdateDish(req, res) {
  const existing = await loadDish(req.params.dishId);
  if (!existing) return dishNotFound(res);

  const { details, values, tagIds } = await validateDishBody(req.body || {}, existing);
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu món không hợp lệ.', details);

  if (values.name && values.name !== existing.name) {
    if (await isNameTaken(values.name, existing.id)) {
      return sendError(res, 409, 'DISH_NAME_EXISTS', 'Tên món trùng với món khác.');
    }
    values.slug = slugify(values.name);
  }
  if (values.is_published === true) {
    const counts = await getRecipeCounts(existing.id);
    if (!counts.ingredients || !counts.steps) {
      return sendError(res, 422, 'RECIPE_REQUIRED', 'Món chưa có công thức nên chưa thể hiển thị.');
    }
  }

  if (Object.keys(values).length > 0) {
    const { error } = await supabaseAdmin.from('dishes').update(values).eq('id', existing.id);
    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'DISH_NAME_EXISTS', 'Tên món trùng với món khác.');
      throw error;
    }
  }
  if (tagIds) await replaceTags(existing.id, tagIds);

  reindexDishInBackground(existing.id);
  recordAuditLog(req.user, 'dish.update', 'dish', existing.id, { fields: Object.keys(values) });
  return sendOk(res, await formatDish(await loadDish(existing.id)));
}

/**
 * 4.10.5 Xóa món – DELETE /admin/dishes/:dishId?confirm=true. Món đã có đánh giá chỉ bị ẩn (luồng 3a).
 */
export async function adminDeleteDish(req, res) {
  requireConfirm(req.query.confirm);
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);

  const { count } = await supabaseAdmin.from('ratings').select('*', { count: 'exact', head: true }).eq('dish_id', dish.id);
  if (count > 0) {
    const { error } = await supabaseAdmin.from('dishes').update({ is_published: false }).eq('id', dish.id);
    if (error) throw error;
    recordAuditLog(req.user, 'dish.hide', 'dish', dish.id, { name: dish.name, rating_count: count });
    return sendOk(res, {
      id: dish.id,
      deleted: false,
      hidden: true,
      reason: `Món đã có ${count} đánh giá nên được ẩn thay vì xóa để giữ dữ liệu đánh giá.`,
    });
  }

  const { error } = await supabaseAdmin.from('dishes').delete().eq('id', dish.id);
  if (error) throw error;
  recordAuditLog(req.user, 'dish.delete', 'dish', dish.id, { name: dish.name });
  return sendOk(res, { id: dish.id, deleted: true, hidden: false, reason: null });
}

/**
 * 5.7.1 Ẩn / hiển thị món – PATCH /admin/dishes/:dishId/publish
 */
export async function adminTogglePublishDish(req, res) {
  const isPublished = parseBool(req.body?.is_published);
  if (isPublished === undefined) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'is_published phải là boolean.', [
      { field: 'is_published', code: 'INVALID_VALUE', message: 'is_published phải là true hoặc false.' },
    ]);
  }
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);
  if (isPublished) {
    const counts = await getRecipeCounts(dish.id);
    if (!counts.ingredients || !counts.steps) {
      return sendError(res, 422, 'RECIPE_REQUIRED', 'Món chưa có công thức nên chưa thể hiển thị.');
    }
  }
  const { error } = await supabaseAdmin.from('dishes').update({ is_published: isPublished }).eq('id', dish.id);
  if (error) throw error;
  recordAuditLog(req.user, isPublished ? 'dish.publish' : 'dish.unpublish', 'dish', dish.id, { name: dish.name });
  return sendOk(res, { id: dish.id, is_published: isPublished });
}

/**
 * 5.7.2 Cập nhật lại véc-tơ tìm kiếm của món – POST /admin/dishes/:dishId/reindex → 202 (chạy nền)
 */
export async function adminReindexDish(req, res) {
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);
  reindexDish(dish.id, { force: true })
    .catch((err) => console.warn(`[Embedding] Reindex món ${dish.id} thất bại:`, err.message));
  return sendOk(res, { dish_id: dish.id, status: 'queued' }, { status: 202 });
}

/**
 * 4.10.6 Tải ảnh món ăn – POST /admin/uploads/images (jpg/png/webp, tối đa 5 MB) → 201
 */
export async function adminUploadImage(req, res) {
  if (!req.file) return sendError(res, 422, 'VALIDATION_ERROR', 'Vui lòng chọn ảnh (trường file).');
  const info = inspectImage(req.file.buffer);
  if (!info) return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');

  const { url } = await uploadDishImage(req.file.buffer, info);
  return sendOk(res, { url, width: info.width, height: info.height, size: req.file.size }, { status: 201 });
}

// ── 4.10.7 – 4.10.8 Nhập món từ file Excel/CSV (chỉ thông tin món; công thức nhập ở mục 4.14.6) ──

const SHEET_DISHES = 'mon_an';
const DISH_IMPORT_COLUMNS = ['slug', 'name', 'description', 'category', 'cook_time_minutes', 'difficulty', 'servings', 'est_cost',
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'tags', 'image_url', 'source_url'];
const MAX_IMPORT_DISHES = 500;
const EXAMPLE_DISH = ['bun-bo-hue', 'Bún bò Huế', 'Món bún đậm đà, cay nhẹ đặc trưng xứ Huế.', 'Món nước', 90, 'medium', 4, 120000,
  520, 32, 58, 18, 'Cay; Món nước', '', ''];

/**
 * 4.10.7 Tải file mẫu nhập món – GET /admin/dishes/import/template?format=xlsx|csv
 */
export async function adminGetImportTemplate(req, res) {
  const format = req.query.format ?? 'xlsx';
  if (!['xlsx', 'csv'].includes(format)) return sendError(res, 400, 'INVALID_QUERY', 'format phải là xlsx hoặc csv.');

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-mon-an.csv"');
    return res.send(buildCsvTemplate(DISH_IMPORT_COLUMNS, EXAMPLE_DISH));
  }

  const { data: tags } = await supabaseAdmin.from('tags').select('name').order('name');
  const guide = [
    ['Cột', 'Bắt buộc', 'Mô tả'],
    ['slug', 'Không', 'Mã món: không dấu, viết thường, nối bằng "-"; để trống thì tự sinh từ tên món. Dùng để nhập công thức từ file ở Quản lý công thức.'],
    ['name', 'Có', 'Tên món (không trùng món đã có hoặc dòng khác trong file).'],
    ['description', 'Không', 'Mô tả.'],
    ['category', 'Có', 'Danh mục món, tối đa 100 ký tự.'],
    ['cook_time_minutes', 'Không', 'Thời gian nấu (phút), số nguyên lớn hơn 0.'],
    ['difficulty', 'Không', 'Một trong: easy | medium | hard.'],
    ['servings', 'Có', 'Số khẩu phần, số nguyên lớn hơn 0.'],
    ['est_cost', 'Không', 'Chi phí ước tính cho cả công thức (VND), số nguyên không âm.'],
    ['calories', 'Không', 'Năng lượng mỗi khẩu phần (kcal).'],
    ['protein_g', 'Không', 'Đạm mỗi khẩu phần (g).'],
    ['carbs_g', 'Không', 'Tinh bột mỗi khẩu phần (g).'],
    ['fat_g', 'Không', 'Chất béo mỗi khẩu phần (g).'],
    ['tags', 'Không', 'Tên thẻ, phân tách bằng dấu ";" (phải có trong danh sách bên dưới).'],
    ['image_url', 'Không', 'Link ảnh http(s) (JPG, PNG hoặc WEBP, tối đa 5 MB). Khi lưu, ảnh được tải về kho ảnh của hệ thống.'],
    ['source_url', 'Không', 'Nguồn tham khảo công thức (URL http(s)).'],
    [],
    ['Món mới luôn ở trạng thái ẩn; bổ sung công thức ở Quản lý công thức rồi mới công khai.'],
    [],
    ['Thẻ hiện có'],
    ...(tags || []).map((t) => [t.name]),
  ];

  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-mon-an.xlsx"');
  return res.send(buildXlsx([
    { name: SHEET_DISHES, rows: [DISH_IMPORT_COLUMNS, EXAMPLE_DISH], cols: DISH_IMPORT_COLUMNS.map((c) => Math.max(14, c.length + 2)) },
    { name: 'Huong_dan', rows: guide, cols: [20, 10, 90] },
  ]));
}

/**
 * 4.10.8 Nhập món ăn từ file Excel/CSV – POST /admin/dishes/import (gửi dạng biểu mẫu: file, dry_run).
 * Món mới luôn ẩn vì chưa có công thức.
 */
export async function adminImportDishes(req, res) {
  if (!req.file) return sendError(res, 400, 'FILE_REQUIRED', 'Thiếu trường file.');
  if (!['xlsx', 'csv'].includes(fileExtension(req.file))) {
    return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ chấp nhận file .xlsx hoặc .csv.');
  }
  const dryRun = req.body?.dry_run === undefined || req.body.dry_run === '' ? true : parseBool(req.body.dry_run);
  if (dryRun === undefined) return sendError(res, 422, 'VALIDATION_ERROR', 'dry_run phải là true hoặc false.');

  let dataRows;
  let warnings;
  try {
    const sheet = readImportFile(req.file, { sheetName: SHEET_DISHES });
    ({ data: dataRows, warnings } = parseTable(sheet, { columns: DISH_IMPORT_COLUMNS, required: ['name', 'category', 'servings'] }));
  } catch (err) {
    if (err.code) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
  if (dataRows.length === 0) return sendError(res, 422, 'EMPTY_FILE', 'File không có dòng dữ liệu nào.');
  if (dataRows.length > MAX_IMPORT_DISHES) {
    return sendError(res, 422, 'TOO_MANY_ROWS', `File có ${dataRows.length} món, tối đa ${MAX_IMPORT_DISHES} món.`);
  }

  const [categoryMap, tagsRes, existingRes] = await Promise.all([
    loadCategoryMap(),
    supabaseAdmin.from('tags').select('id, name'),
    supabaseAdmin.from('dishes').select('slug, name'),
  ]);
  if (tagsRes.error) throw tagsRes.error;
  if (existingRes.error) throw existingRes.error;
  const tagByName = new Map((tagsRes.data || []).map((t) => [normalizeText(t.name), t.id]));
  const existingSlugs = new Set((existingRes.data || []).flatMap((d) => [d.slug, slugify(d.name)]));
  const rowBySlug = new Map(); // slug (khai báo hoặc tự sinh từ tên) → dòng đầu tiên dùng nó trong file

  const errors = [];
  let valid = [];
  for (const { row, obj } of dataRows) {
    const text = (k) => String(obj[k] ?? '').trim();
    const rawSlug = text('slug');
    const name = text('name');
    const declaredSlug = rawSlug ? slugify(rawSlug) : '';
    const slug = declaredSlug || slugify(name);
    const rowErrors = [];
    const err = (field, code, message) => rowErrors.push({ row, slug: slug || null, field, code, message });

    const category = text('category').replace(/\s+/g, ' ');
    const servingsRaw = text('servings');
    if (!name) err('name', 'REQUIRED', 'Tên món không được để trống.');
    else if (name.length > 200) err('name', 'INVALID_VALUE', 'Tên món tối đa 200 ký tự.');
    if (!category) err('category', 'REQUIRED', 'Danh mục không được để trống.');
    if (!servingsRaw) err('servings', 'REQUIRED', 'Số khẩu phần không được để trống.');
    if (rawSlug && !declaredSlug) err('slug', 'INVALID_VALUE', 'slug chỉ gồm chữ không dấu, số và dấu "-".');

    // Trùng tên hoặc slug với món đã có / với dòng khác trong file
    const nameSlug = slugify(name);
    if (nameSlug && existingSlugs.has(nameSlug)) err('name', 'DISH_NAME_EXISTS', 'Tên món đã tồn tại trong hệ thống.');
    else if (declaredSlug && existingSlugs.has(declaredSlug)) err('slug', 'DISH_NAME_EXISTS', `slug "${declaredSlug}" đã được dùng cho món khác.`);
    else if (nameSlug && rowBySlug.has(nameSlug)) err('name', 'DUPLICATE_IN_FILE', `Trùng tên với món ở dòng ${rowBySlug.get(nameSlug)}.`);
    else if (declaredSlug && rowBySlug.has(declaredSlug)) err('slug', 'DUPLICATE_IN_FILE', `Trùng slug với món ở dòng ${rowBySlug.get(declaredSlug)}.`);
    [nameSlug, declaredSlug].forEach((s) => { if (s && !rowBySlug.has(s)) rowBySlug.set(s, row); });
    if (category.length > 100) err('category', 'CATEGORY_TOO_LONG', 'Danh mục tối đa 100 ký tự.');

    const values = { name, slug, category, description: text('description') || null };
    if (servingsRaw) {
      const n = Number(servingsRaw);
      if (!Number.isInteger(n) || n < 1) err('servings', 'INVALID_VALUE', 'Số khẩu phần phải là số nguyên lớn hơn 0.');
      values.servings = n;
    }
    for (const f of NUMERIC_FIELDS) {
      const raw = text(f);
      if (!raw) { values[f] = null; continue; }
      const n = Number(raw);
      const min = f === 'cook_time_minutes' ? 1 : 0;
      if (!Number.isInteger(n) || n < min) err(f, 'INVALID_VALUE', `${f} phải là số nguyên ${min > 0 ? 'lớn hơn 0' : 'không âm'}.`);
      values[f] = n;
    }
    const difficulty = text('difficulty').toLowerCase();
    if (difficulty && !DIFFICULTIES.includes(difficulty)) err('difficulty', 'INVALID_VALUE', 'Độ khó phải là easy, medium hoặc hard.');
    values.difficulty = difficulty || null;

    for (const f of ['image_url', 'source_url']) {
      const url = text(f);
      if (url && !isHttpUrl(url)) err(f, 'INVALID_URL', `${f === 'image_url' ? 'URL ảnh' : 'URL nguồn tham khảo'} không hợp lệ.`);
      values[f] = url || null;
    }

    const tagIds = [];
    for (const tagName of text('tags').split(';').map((t) => t.trim()).filter(Boolean)) {
      const id = tagByName.get(normalizeText(tagName));
      if (!id) err('tags', 'TAG_NOT_FOUND', `Thẻ "${tagName}" không tồn tại.`);
      else if (!tagIds.includes(id)) tagIds.push(id);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
    } else {
      // Dùng lại cách viết danh mục đã có (trong CSDL hoặc ở dòng trước trong file)
      const key = normalizeText(category);
      if (!categoryMap.has(key)) categoryMap.set(key, category);
      values.category = categoryMap.get(key);
      valid.push({ row, values, tagIds });
    }
  }

  const result = {
    dry_run: dryRun,
    file_name: req.file.originalname,
    total_dishes: dataRows.length,
    valid_dishes: valid.length,
    error_dishes: dataRows.length - valid.length,
    created_count: 0,
    errors,
    warnings: warnings || [],
  };
  if (dryRun) return sendOk(res, result);

  if (valid.length === 0) {
    return sendError(res, 422, 'NO_VALID_ROWS', 'Không có món hợp lệ nào để lưu.', errors);
  }

  // Tải ảnh từ cột image_url về bucket "dishes" để ảnh không phụ thuộc trang gốc.
  // Ảnh nào không tải được thì giữ nguyên link gốc và báo trong warnings, không chặn việc nhập món.
  const uploadedImages = new Map(); // dòng → đường dẫn ảnh trong Storage, để xóa khi hoàn tác
  const pending = valid.filter((v) => v.values.image_url && !isOwnDishImageUrl(v.values.image_url));
  const IMAGE_CONCURRENCY = 4;
  for (let i = 0; i < pending.length; i += IMAGE_CONCURRENCY) {
    await Promise.all(pending.slice(i, i + IMAGE_CONCURRENCY).map(async (v) => {
      const image = await importRemoteDishImage(v.values.image_url);
      if (image.error) {
        result.warnings.push(`Dòng ${v.row} (${v.values.name}): ${image.error}, giữ nguyên link ảnh gốc.`);
        return;
      }
      v.values.image_url = image.url;
      uploadedImages.set(v.row, image.path);
    }));
  }
  const removeUploadedImages = (rows) => removeDishImages(rows.map((v) => uploadedImages.get(v.row)).filter(Boolean));

  // Ghi tất cả món hợp lệ trong một câu lệnh; lỗi khi gắn thẻ thì xóa các món vừa tạo
  const insertDishes = () => supabaseAdmin
    .from('dishes')
    .insert(valid.map((v) => ({ ...v.values, is_published: false, created_by: req.user.id })))
    .select('id, name, slug');
  let { data: created, error: insertErr } = await insertDishes();
  if (insertErr?.code === '23505') {
    // Luồng 3g: có món cùng tên/slug vừa được tạo sau lúc xem trước → bỏ qua các món đó rồi ghi lại một lần
    const { data: current, error: reloadErr } = await supabaseAdmin.from('dishes').select('slug, name');
    if (reloadErr) throw reloadErr;
    const taken = new Set((current || []).flatMap((d) => [d.slug, slugify(d.name)]));
    const conflicts = valid.filter((v) => taken.has(v.values.slug) || taken.has(slugify(v.values.name)));
    conflicts.forEach((v) => errors.push({
      row: v.row, slug: v.values.slug, field: 'name', code: 'DISH_NAME_EXISTS',
      message: 'Món cùng tên hoặc slug vừa được tạo sau lúc xem trước nên bị bỏ qua.',
    }));
    await removeUploadedImages(conflicts);
    valid = valid.filter((v) => !conflicts.includes(v));
    result.valid_dishes = valid.length;
    result.error_dishes = dataRows.length - valid.length;
    if (valid.length === 0) return sendError(res, 422, 'NO_VALID_ROWS', 'Không có món hợp lệ nào để lưu.', errors);
    ({ data: created, error: insertErr } = await insertDishes());
  }
  if (insertErr) {
    await removeUploadedImages(valid);
    console.error('[Import] Lỗi ghi món:', insertErr);
    return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi dữ liệu; không món nào được tạo.');
  }
  const idBySlug = new Map(created.map((d) => [d.slug, d.id]));
  const tagRows = valid.flatMap((v) => v.tagIds.map((tag_id) => ({ dish_id: idBySlug.get(v.values.slug), tag_id })));
  if (tagRows.length > 0) {
    const { error: tagErr } = await supabaseAdmin.from('dish_tags').insert(tagRows);
    if (tagErr) {
      await supabaseAdmin.from('dishes').delete().in('id', created.map((d) => d.id));
      await removeUploadedImages(valid);
      console.error('[Import] Lỗi gắn thẻ, đã hoàn tác:', tagErr);
      return sendError(res, 500, 'IMPORT_FAILED', 'Lỗi khi ghi dữ liệu; đã hoàn tác, không món nào được tạo.');
    }
  }

  created.forEach((d) => reindexDishInBackground(d.id));
  recordAuditLog(req.user, 'dish.import', 'dish', null, {
    file_name: req.file.originalname,
    total_dishes: dataRows.length,
    created_count: created.length,
    dish_ids: created.map((d) => d.id),
  });

  return sendOk(res, {
    ...result,
    created_count: created.length,
    created: created.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
  }, { status: 201 });
}

// ── 4.14 Công thức ──────────────────────────────────────────────────────────

/**
 * 4.14.1 Xem công thức – GET /admin/dishes/:dishId/recipe
 */
export async function adminGetDishRecipe(req, res) {
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);
  const recipe = await readRecipe(dish.id);
  if (recipe.steps.length === 0 && recipe.ingredients.length === 0) {
    return sendError(res, 404, 'RECIPE_NOT_FOUND', 'Món chưa có công thức.');
  }
  return sendOk(res, { dish_id: dish.id, servings: dish.servings, is_published: dish.is_published, ...recipe, updated_at: dish.updated_at });
}

async function readRecipe(dishId) {
  const [stepsRes, ingsRes] = await Promise.all([
    supabaseAdmin.from('recipe_steps').select('step_order, content').eq('dish_id', dishId).order('step_order'),
    supabaseAdmin.from('dish_ingredients')
      .select('quantity, unit, is_optional, ingredient:ingredients(id, name, needs_review)')
      .eq('dish_id', dishId),
  ]);
  if (stepsRes.error) throw stepsRes.error;
  if (ingsRes.error) throw ingsRes.error;
  return {
    steps: (stepsRes.data || []).map((s) => ({ order: s.step_order, content: s.content })),
    ingredients: (ingsRes.data || []).map((di) => ({
      ingredient_id: Number(di.ingredient.id),
      name: di.ingredient.name,
      quantity: Number(di.quantity),
      unit: di.unit,
      is_optional: di.is_optional,
      needs_review: di.ingredient.needs_review,
    })),
  };
}

/**
 * Kiểm tra dữ liệu công thức gửi lên và quy mỗi dòng nguyên liệu về ingredient_id (chưa ghi CSDL).
 * Nguyên liệu gõ tên chưa có được đánh dấu toCreate để tạo khi lưu.
 */
async function prepareRecipe(body) {
  const details = [];
  const add = (field, code, message) => details.push({ field, code, message });
  const { steps, ingredients } = body || {};

  if (!Array.isArray(steps) || steps.length === 0) add('steps', 'REQUIRED', 'Cần ít nhất 1 bước chế biến.');
  if (!Array.isArray(ingredients) || ingredients.length === 0) add('ingredients', 'REQUIRED', 'Cần ít nhất 1 nguyên liệu.');
  if (details.length) return { details };

  // Bước: order không bắt buộc; nếu gửi thì phải liên tục từ 1 (chấp nhận khóa cũ step_number/instruction)
  const parsedSteps = steps.map((s, idx) => ({
    order: s?.order ?? s?.step_number,
    content: typeof (s?.content ?? s?.instruction) === 'string' ? (s.content ?? s.instruction).trim() : '',
    idx,
  }));
  parsedSteps.forEach((s) => { if (!s.content) add(`steps[${s.idx}].content`, 'REQUIRED', 'Nội dung bước không được để trống.'); });
  const hasOrder = parsedSteps.some((s) => s.order !== undefined && s.order !== null);
  let orderedSteps = parsedSteps.map((s, idx) => ({ order: idx + 1, content: s.content }));
  if (hasOrder) {
    const orders = parsedSteps.map((s) => Number(s.order));
    const sorted = [...orders].sort((a, b) => a - b);
    if (sorted.some((o, i) => o !== i + 1)) add('steps', 'INVALID_ORDER', 'order của các bước phải liên tục từ 1.');
    else orderedSteps = parsedSteps.map((s) => ({ order: Number(s.order), content: s.content })).sort((a, b) => a.order - b.order);
  }

  // Nguyên liệu
  const { data: allIngredients, error } = await supabaseAdmin
    .from('ingredients')
    .select('id, name, normalized_name, aliases, default_unit, allergen_group_id, needs_review');
  if (error) throw error;
  const byId = new Map(allIngredients.map((i) => [Number(i.id), i]));
  const byName = new Map();
  for (const i of allIngredients) {
    byName.set(i.normalized_name, i);
    (i.aliases || []).forEach((a) => { if (!byName.has(normalizeText(a))) byName.set(normalizeText(a), i); });
  }
  const { data: groups } = await supabaseAdmin.from('allergen_groups').select('id');
  const groupIds = new Set((groups || []).map((g) => g.id));

  const lines = [];
  const pendingNew = new Map(); // tên đã chuẩn hóa → dòng nguyên liệu cần tạo mới
  const seen = new Set();
  ingredients.forEach((ing, idx) => {
    const f = `ingredients[${idx}]`;
    const quantity = Number(ing?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) add(`${f}.quantity`, 'INVALID_VALUE', 'quantity phải lớn hơn 0.');
    const allergenGroupId = ing?.allergen_group_id != null && ing.allergen_group_id !== '' ? Number(ing.allergen_group_id) : null;
    if (allergenGroupId !== null && !groupIds.has(allergenGroupId)) add(`${f}.allergen_group_id`, 'NOT_FOUND', 'Nhóm dị ứng không tồn tại.');
    const noAllergen = parseBool(ing?.no_allergen) === true;
    const unit = typeof ing?.unit === 'string' && ing.unit.trim() ? ing.unit.trim() : null;

    let key;
    let existing = null;
    if (ing?.ingredient_id != null && ing.ingredient_id !== '') {
      existing = byId.get(Number(ing.ingredient_id));
      if (!existing) { add(`${f}.ingredient_id`, 'NOT_FOUND', 'Nguyên liệu không tồn tại.'); return; }
      key = `id:${existing.id}`;
    } else {
      const name = typeof ing?.name === 'string' ? ing.name.trim().replace(/\s+/g, ' ') : '';
      if (!name) { add(f, 'REQUIRED', 'Mỗi dòng cần ingredient_id hoặc name.'); return; }
      existing = byName.get(normalizeText(name)) || null;
      key = existing ? `id:${existing.id}` : `new:${normalizeText(name)}`;
      if (!existing && !pendingNew.has(key)) {
        pendingNew.set(key, {
          name,
          default_unit: unit || 'g',
          allergen_group_id: allergenGroupId,
          needs_review: false,
        });
      }
    }
    // Không trùng nguyên liệu trong cùng công thức (so sau khi quy về cùng một nguyên liệu)
    if (seen.has(key)) { add(f, 'DUPLICATE_INGREDIENT', 'Nguyên liệu bị trùng trong công thức.'); return; }
    seen.add(key);

    lines.push({
      key,
      existing,
      quantity,
      unit: unit || existing?.default_unit || 'g',
      is_optional: parseBool(ing?.is_optional) === true,
      // Xác nhận lại nhóm dị ứng cho nguyên liệu đang needs_review
      review: existing?.needs_review && (allergenGroupId !== null || noAllergen)
        ? { allergen_group_id: allergenGroupId, needs_review: false }
        : null,
    });
  });

  return { details, steps: orderedSteps, lines, pendingNew };
}

/**
 * Ghi công thức. Supabase không hỗ trợ giao dịch nhiều câu lệnh nên ghi theo thứ tự: ghi đè dòng mới rồi xóa dòng thừa,
 * để công thức không lúc nào rỗng (tránh vi phạm ràng buộc RECIPE_REQUIRED với món đang hiển thị);
 * lỗi giữa chừng thì xóa các nguyên liệu vừa tạo.
 */
async function writeRecipe(dishId, prepared, userId, publish) {
  const created = [];
  try {
    for (const [key, row] of prepared.pendingNew) {
      const { data, error } = await supabaseAdmin
        .from('ingredients')
        .insert({ ...row, created_by: userId })
        .select('id, name, needs_review')
        .single();
      if (error) throw error;
      created.push({ key, ...data, id: Number(data.id) });
    }
    const newIdByKey = new Map(created.map((c) => [c.key, c.id]));

    for (const line of prepared.lines) {
      if (line.review) {
        const { error } = await supabaseAdmin.from('ingredients').update(line.review).eq('id', line.existing.id);
        if (error) throw error;
      }
    }

    const ingRows = prepared.lines.map((l) => ({
      dish_id: dishId,
      ingredient_id: l.existing ? Number(l.existing.id) : newIdByKey.get(l.key),
      quantity: l.quantity,
      unit: l.unit,
      is_optional: l.is_optional,
    }));
    const { error: ingErr } = await supabaseAdmin.from('dish_ingredients').upsert(ingRows, { onConflict: 'dish_id,ingredient_id' });
    if (ingErr) throw ingErr;
    const keepIds = ingRows.map((r) => r.ingredient_id);
    const { error: pruneIngErr } = await supabaseAdmin
      .from('dish_ingredients')
      .delete()
      .eq('dish_id', dishId)
      .not('ingredient_id', 'in', `(${keepIds.join(',')})`);
    if (pruneIngErr) throw pruneIngErr;

    const stepRows = prepared.steps.map((s) => ({ dish_id: dishId, step_order: s.order, content: s.content }));
    const { error: stepErr } = await supabaseAdmin.from('recipe_steps').upsert(stepRows, { onConflict: 'dish_id,step_order' });
    if (stepErr) throw stepErr;
    const { error: pruneStepErr } = await supabaseAdmin
      .from('recipe_steps')
      .delete()
      .eq('dish_id', dishId)
      .gt('step_order', stepRows.length);
    if (pruneStepErr) throw pruneStepErr;

    if (publish) {
      const { error } = await supabaseAdmin.from('dishes').update({ is_published: true }).eq('id', dishId);
      if (error) throw error;
    } else {
      // Cập nhật updated_at của món để thể hiện công thức vừa thay đổi
      await supabaseAdmin.from('dishes').update({ updated_at: new Date().toISOString() }).eq('id', dishId);
    }
  } catch (err) {
    if (created.length > 0) {
      const ids = created.map((c) => c.id);
      await supabaseAdmin.from('dish_ingredients').delete().in('ingredient_id', ids);
      await supabaseAdmin.from('ingredients').delete().in('id', ids);
    }
    throw err;
  }
  return created.map(({ id, name, needs_review: needsReview }) => ({ id, name, needs_review: needsReview }));
}

async function saveRecipe(req, res, mode) {
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);

  const counts = await getRecipeCounts(dish.id);
  const hasRecipe = counts.ingredients > 0 || counts.steps > 0;
  if (mode === 'create' && hasRecipe) return sendError(res, 409, 'RECIPE_EXISTS', 'Món đã có công thức; dùng PUT để sửa.');
  if (mode === 'update' && !hasRecipe) return sendError(res, 404, 'RECIPE_NOT_FOUND', 'Món chưa có công thức; dùng POST để tạo.');

  const publish = req.body?.publish === undefined ? (mode === 'create' ? false : undefined) : parseBool(req.body.publish);
  if (req.body?.publish !== undefined && publish === undefined) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'publish phải là boolean.');
  }

  const prepared = await prepareRecipe(req.body);
  if (prepared.details.length > 0) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Công thức không hợp lệ.', prepared.details);
  }

  const newIngredients = await writeRecipe(dish.id, prepared, req.user.id, publish === true);
  reindexDishInBackground(dish.id);
  recordAuditLog(req.user, mode === 'create' ? 'recipe.create' : 'recipe.update', 'dish', dish.id, {
    name: dish.name,
    new_ingredient_ids: newIngredients.map((i) => i.id),
    published: publish === true,
  });

  const fresh = await loadDish(dish.id);
  return sendOk(res, {
    dish_id: dish.id,
    servings: fresh.servings,
    is_published: fresh.is_published,
    ...(await readRecipe(dish.id)),
    new_ingredients: newIngredients,
    updated_at: fresh.updated_at,
  }, { status: mode === 'create' ? 201 : 200 });
}

/** 4.14.2 Thêm công thức – POST /admin/dishes/:dishId/recipe */
export async function adminCreateDishRecipe(req, res) {
  return saveRecipe(req, res, 'create');
}

/** 4.14.3 Sửa công thức – PUT /admin/dishes/:dishId/recipe */
export async function adminUpdateDishRecipe(req, res) {
  return saveRecipe(req, res, 'update');
}

/**
 * 4.14.4 Xóa công thức – DELETE /admin/dishes/:dishId/recipe?confirm=true. Món đang hiển thị sẽ bị ẩn.
 */
export async function adminDeleteDishRecipe(req, res) {
  requireConfirm(req.query.confirm);
  const dish = await loadDish(req.params.dishId);
  if (!dish) return dishNotFound(res);
  const counts = await getRecipeCounts(dish.id);
  if (!counts.ingredients && !counts.steps) return sendError(res, 404, 'RECIPE_NOT_FOUND', 'Món chưa có công thức.');

  // Ẩn món trước để không vi phạm ràng buộc "món hiển thị phải có công thức"
  const wasPublished = dish.is_published;
  if (wasPublished) {
    const { error } = await supabaseAdmin.from('dishes').update({ is_published: false }).eq('id', dish.id);
    if (error) throw error;
  }
  const [ingDel, stepDel] = await Promise.all([
    supabaseAdmin.from('dish_ingredients').delete().eq('dish_id', dish.id),
    supabaseAdmin.from('recipe_steps').delete().eq('dish_id', dish.id),
  ]);
  if (ingDel.error) throw ingDel.error;
  if (stepDel.error) throw stepDel.error;

  reindexDishInBackground(dish.id);
  recordAuditLog(req.user, 'recipe.delete', 'dish', dish.id, { name: dish.name, dish_hidden: wasPublished });
  return sendOk(res, { dish_id: dish.id, deleted: true, dish_hidden: wasPublished });
}
