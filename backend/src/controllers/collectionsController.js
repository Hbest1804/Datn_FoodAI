// src/controllers/collectionsController.js
// Bộ sưu tập món ăn (mở rộng) – mục 5.6 của tài liệu API

import { supabaseAdmin } from '../config/supabase.js';
import { toDishSummary } from '../services/recommendationService.js';
import { pageMeta, parsePagination, sendError, sendOk } from '../utils/http.js';

const DISH_CARD = 'id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count';

function notFound(res, message = 'Bộ sưu tập không tồn tại.') {
  return sendError(res, 404, 'COLLECTION_NOT_FOUND', message);
}

function readName(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  return name && name.length <= 100 ? name : null;
}

function nameError(res) {
  return sendError(res, 422, 'VALIDATION_ERROR', 'Tên bộ sưu tập không được để trống và tối đa 100 ký tự.', [
    { field: 'name', code: 'INVALID_VALUE', message: 'Tên 1–100 ký tự.' },
  ]);
}

async function findOwnCollection(collectionId, userId) {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, user_id, created_at, updated_at')
    .eq('id', collectionId)
    .maybeSingle();
  if (error) throw error;
  return data && data.user_id === userId ? data : null;
}

/** 5.6.1 Danh sách bộ sưu tập – GET /me/collections */
export async function listCollections(req, res) {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, created_at, updated_at, collection_dishes(count)')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return sendOk(res, (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    dish_count: c.collection_dishes?.[0]?.count || 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  })));
}

/** 5.6.2 Tạo bộ sưu tập – POST /me/collections */
export async function createCollection(req, res) {
  const name = readName(req.body);
  if (!name) return nameError(res);
  const { data, error } = await supabaseAdmin
    .from('collections')
    .insert({ user_id: req.user.id, name })
    .select('id, name')
    .single();
  if (error) throw error;
  return sendOk(res, { ...data, dish_count: 0 }, { status: 201 });
}

/** 5.6.3 Chi tiết bộ sưu tập – GET /me/collections/:collectionId */
export async function getCollection(req, res) {
  const collection = await findOwnCollection(req.params.collectionId, req.user.id);
  if (!collection) return notFound(res);
  const pg = parsePagination(req.query);

  const { data, count, error } = await supabaseAdmin
    .from('collection_dishes')
    .select(`added_at, dish:dishes(${DISH_CARD})`, { count: 'exact' })
    .eq('collection_id', collection.id)
    .order('added_at', { ascending: false })
    .range(pg.from, pg.to);
  if (error) throw error;

  const dishIds = (data || []).map((r) => r.dish?.id).filter(Boolean);
  const { data: favs } = dishIds.length
    ? await supabaseAdmin.from('favorites').select('dish_id').eq('user_id', req.user.id).in('dish_id', dishIds)
    : { data: [] };
  const favSet = new Set((favs || []).map((f) => f.dish_id));

  return sendOk(res, {
    id: collection.id,
    name: collection.name,
    dishes: (data || []).filter((r) => r.dish).map((r) => toDishSummary(r.dish, favSet.has(r.dish.id))),
  }, { meta: pageMeta(pg, count) });
}

/** 5.6.4 Đổi tên bộ sưu tập – PATCH /me/collections/:collectionId */
export async function renameCollection(req, res) {
  const name = readName(req.body);
  if (!name) return nameError(res);
  const collection = await findOwnCollection(req.params.collectionId, req.user.id);
  if (!collection) return notFound(res);
  const { data, error } = await supabaseAdmin
    .from('collections')
    .update({ name })
    .eq('id', collection.id)
    .select('id, name')
    .single();
  if (error) throw error;
  return sendOk(res, data);
}

/** 5.6.5 Xóa bộ sưu tập – DELETE /me/collections/:collectionId (món gốc không bị ảnh hưởng) */
export async function deleteCollection(req, res) {
  const collection = await findOwnCollection(req.params.collectionId, req.user.id);
  if (!collection) return notFound(res);
  const { error } = await supabaseAdmin.from('collections').delete().eq('id', collection.id);
  if (error) throw error;
  return res.status(204).send();
}

/** 5.6.6 Thêm món vào bộ sưu tập – PUT /me/collections/:collectionId/dishes/:dishId (idempotent) */
export async function addDishToCollection(req, res) {
  const collection = await findOwnCollection(req.params.collectionId, req.user.id);
  if (!collection) return notFound(res, 'Bộ sưu tập hoặc món không tồn tại.');
  const { data: dish } = await supabaseAdmin.from('dishes').select('id, is_published').eq('id', req.params.dishId).maybeSingle();
  if (!dish?.is_published) return notFound(res, 'Bộ sưu tập hoặc món không tồn tại.');

  const { error } = await supabaseAdmin
    .from('collection_dishes')
    .upsert({ collection_id: collection.id, dish_id: dish.id }, { onConflict: 'collection_id,dish_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data: row, error: rowErr } = await supabaseAdmin
    .from('collection_dishes')
    .select('collection_id, dish_id, added_at')
    .eq('collection_id', collection.id)
    .eq('dish_id', dish.id)
    .single();
  if (rowErr) throw rowErr;
  await supabaseAdmin.from('collections').update({ updated_at: new Date().toISOString() }).eq('id', collection.id);
  return sendOk(res, row);
}

/** 5.6.7 Bỏ món khỏi bộ sưu tập – DELETE /me/collections/:collectionId/dishes/:dishId */
export async function removeDishFromCollection(req, res) {
  const collection = await findOwnCollection(req.params.collectionId, req.user.id);
  if (!collection) return notFound(res, 'Không tìm thấy.');
  const { data, error } = await supabaseAdmin
    .from('collection_dishes')
    .delete()
    .eq('collection_id', collection.id)
    .eq('dish_id', req.params.dishId)
    .select('dish_id');
  if (error) throw error;
  if (!data || data.length === 0) return notFound(res, 'Không tìm thấy.');
  return res.status(204).send();
}
