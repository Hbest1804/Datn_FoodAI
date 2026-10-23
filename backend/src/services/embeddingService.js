// src/services/embeddingService.js
// Véc-tơ cho phần trí tuệ nhân tạo:
//   - dish_embeddings: véc-tơ của từng món, tự cập nhật khi lưu món/công thức
//   - user_profiles.profile_vector / taste_vector: véc-tơ hồ sơ khẩu vị và sở thích tổng hợp
//   - truy hồi món theo độ tương đồng cosine cho chatbot

import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './aiService.js';

const DIM = 768;

/** Cột véc-tơ trong CSDL được trả về dạng chuỗi "[0.1,0.2,...]"; chuyển thành mảng số. */
export function parseVector(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(Number);
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.map(Number) : null;
  } catch {
    return null;
  }
}

export function toPgVector(vec) {
  return `[${vec.join(',')}]`;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? vec : vec.map((x) => x / norm);
}

// ── Véc-tơ của món ăn ────────────────────────────────────────────────────────

function buildDishText(dish) {
  const ingredients = (dish.dish_ingredients || []).map((di) => di.ingredient?.name).filter(Boolean).join(', ');
  const tags = (dish.dish_tags || []).map((dt) => dt.tag?.name).filter(Boolean).join(', ');
  return [
    `Tên món: ${dish.name}`,
    dish.category ? `Danh mục: ${dish.category}` : '',
    dish.description ? `Mô tả: ${dish.description}` : '',
    ingredients ? `Nguyên liệu: ${ingredients}` : '',
    tags ? `Đặc trưng: ${tags}` : '',
  ].filter(Boolean).join('. ');
}

let dishEmbeddingCache = null;

/**
 * Tính lại véc-tơ cho một món. Bỏ qua nếu nội dung không đổi (so content_hash) trừ khi force = true.
 */
export async function reindexDish(dishId, { force = false } = {}) {
  const { data: dish, error } = await supabaseAdmin
    .from('dishes')
    .select('id, name, description, category, dish_ingredients(ingredient:ingredients(name)), dish_tags(tag:tags(name))')
    .eq('id', dishId)
    .maybeSingle();
  if (error) throw error;
  if (!dish) return { status: 'not_found' };

  const text = buildDishText(dish);
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('dish_embeddings')
      .select('content_hash')
      .eq('dish_id', dishId)
      .maybeSingle();
    if (existing?.content_hash === contentHash) return { status: 'unchanged' };
  }

  const { embedding, model } = await generateEmbedding(text, DIM);
  const { error: upsertErr } = await supabaseAdmin.from('dish_embeddings').upsert({
    dish_id: dishId,
    embedding: toPgVector(embedding),
    content_hash: contentHash,
    model,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'dish_id' });
  if (upsertErr) throw upsertErr;

  dishEmbeddingCache = null;
  return { status: 'updated', model };
}

/** Chạy nền sau khi lưu món: lỗi chỉ ghi nhật ký, không làm hỏng yêu cầu đang xử lý. */
export function reindexDishInBackground(dishId) {
  reindexDish(dishId).catch((err) => console.warn(`[Embedding] Không cập nhật được véc-tơ món ${dishId}:`, err.message));
}

/** Tạo véc-tơ cho các món chưa có hoặc đã đổi nội dung (chạy khi khởi động máy chủ). */
export async function indexStaleDishes() {
  const { data: dishes, error } = await supabaseAdmin.from('dishes').select('id');
  if (error) throw error;
  let updated = 0;
  for (const d of dishes || []) {
    try {
      const r = await reindexDish(d.id);
      if (r.status === 'updated') updated++;
    } catch (err) {
      console.warn('[Embedding] Dừng tạo véc-tơ món:', err.message);
      break;
    }
  }
  return updated;
}

/** Bảng tra dish_id → véc-tơ (lưu đệm 5 phút, xóa khi có món được cập nhật). */
export async function getDishEmbeddings() {
  if (dishEmbeddingCache && dishEmbeddingCache.expiresAt > Date.now()) return dishEmbeddingCache.map;
  const { data, error } = await supabaseAdmin.from('dish_embeddings').select('dish_id, embedding');
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    const v = parseVector(row.embedding);
    if (v) map.set(row.dish_id, v);
  }
  dishEmbeddingCache = { map, expiresAt: Date.now() + 5 * 60 * 1000 };
  return map;
}

// ── Véc-tơ người dùng ────────────────────────────────────────────────────────

const LEVEL_WORDS = ['không', 'rất ít', 'ít', 'vừa', 'nhiều', 'rất nhiều'];

async function buildProfileText(userId, profile) {
  const [diets, allergies, dislikes] = await Promise.all([
    supabaseAdmin.from('user_diets').select('diet_types(name)').eq('user_id', userId),
    supabaseAdmin.from('user_allergies').select('allergen_groups(name)').eq('user_id', userId),
    supabaseAdmin.from('user_disliked_ingredients').select('ingredients(name)').eq('user_id', userId),
  ]);
  const prefs = profile?.taste_prefs || {};
  const likedIds = Array.isArray(prefs.liked_ingredient_ids) ? prefs.liked_ingredient_ids : [];
  let likedNames = [];
  if (likedIds.length > 0) {
    const { data } = await supabaseAdmin.from('ingredients').select('name').in('id', likedIds);
    likedNames = (data || []).map((r) => r.name);
  }

  const parts = [];
  const lv = (k) => (Number.isInteger(prefs[k]) ? LEVEL_WORDS[prefs[k]] : null);
  const tastes = [['cay', lv('spicy_level')], ['mặn', lv('salty_level')], ['ngọt', lv('sweet_level')], ['chua', lv('sour_level')]]
    .filter(([, w]) => w)
    .map(([t, w]) => `${t} ${w}`);
  if (tastes.length) parts.push(`Khẩu vị: ${tastes.join(', ')}`);
  if (likedNames.length) parts.push(`Thích nguyên liệu: ${likedNames.join(', ')}`);
  const dietNames = (diets.data || []).map((r) => r.diet_types?.name).filter(Boolean);
  if (dietNames.length) parts.push(`Chế độ ăn: ${dietNames.join(', ')}`);
  const dislikeNames = (dislikes.data || []).map((r) => r.ingredients?.name).filter(Boolean);
  if (dislikeNames.length) parts.push(`Không thích: ${dislikeNames.join(', ')}`);
  const allergyNames = (allergies.data || []).map((r) => r.allergen_groups?.name).filter(Boolean);
  if (allergyNames.length) parts.push(`Tránh nhóm dị ứng: ${allergyNames.join(', ')}`);
  if (profile?.calorie_goal) parts.push(`Mục tiêu ${profile.calorie_goal} kcal mỗi ngày`);
  return parts.join('. ');
}

/**
 * Tính lại profile_vector (từ hồ sơ khẩu vị) và taste_vector (hồ sơ + món đã yêu thích, đánh giá cao, xem nhiều).
 * taste_vector = chuẩn hóa(1·profile_vector + Σ trọng số · dish_embedding), trọng số:
 *   yêu thích 1.0; đánh giá: (sao − 3) · 0.5 (âm khi chấm 1–2 sao); xem: 0.1 · min(lượt xem, 5).
 */
export async function recomputeUserVectors(userId, { refreshProfile = true } = {}) {
  const { data: profile } = await supabaseAdmin.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();

  // Chỉ tạo lại véc-tơ hồ sơ khi hồ sơ thay đổi; tương tác (xem, yêu thích, đánh giá) dùng lại profile_vector đã lưu
  let profileVector = refreshProfile ? null : parseVector(profile?.profile_vector);
  if (refreshProfile) {
    const profileText = await buildProfileText(userId, profile);
    if (profileText) profileVector = (await generateEmbedding(profileText, DIM)).embedding;
  }

  const [favs, ratings, views, embeddings] = await Promise.all([
    supabaseAdmin.from('favorites').select('dish_id').eq('user_id', userId),
    supabaseAdmin.from('ratings').select('dish_id, stars').eq('user_id', userId),
    supabaseAdmin.from('view_history').select('dish_id, view_count').eq('user_id', userId),
    getDishEmbeddings(),
  ]);

  const weights = new Map();
  const add = (dishId, w) => weights.set(dishId, (weights.get(dishId) || 0) + w);
  (favs.data || []).forEach((f) => add(f.dish_id, 1));
  (ratings.data || []).forEach((r) => add(r.dish_id, (r.stars - 3) * 0.5));
  (views.data || []).forEach((v) => add(v.dish_id, 0.1 * Math.min(v.view_count || 1, 5)));

  let taste = profileVector ? [...profileVector] : null;
  for (const [dishId, w] of weights) {
    const vec = embeddings.get(dishId);
    if (!vec || w === 0) continue;
    if (!taste) taste = new Array(vec.length).fill(0);
    for (let i = 0; i < vec.length; i++) taste[i] += w * vec[i];
  }
  const tasteVector = taste && taste.some((x) => x !== 0) ? normalize(taste) : null;

  const { error } = await supabaseAdmin.from('user_profiles').upsert({
    user_id: userId,
    profile_vector: profileVector ? toPgVector(profileVector) : null,
    taste_vector: tasteVector ? toPgVector(tasteVector) : null,
    taste_vector_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
  return { profileVector, tasteVector };
}

const pendingRecompute = new Map();

/** Sau tương tác của người dùng: gom các thay đổi trong 30 giây rồi tính lại taste_vector một lần. */
export function recomputeUserVectorsInBackground(userId) {
  if (pendingRecompute.has(userId)) return;
  const timer = setTimeout(() => {
    pendingRecompute.delete(userId);
    recomputeUserVectors(userId, { refreshProfile: false })
      .catch((err) => console.warn(`[Embedding] Không tính lại được véc-tơ người dùng ${userId}:`, err.message));
  }, 30 * 1000);
  timer.unref();
  pendingRecompute.set(userId, timer);
}
