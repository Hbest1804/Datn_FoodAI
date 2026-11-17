// src/controllers/mealPlanController.js
// Gợi ý thực đơn tuần (UC17): sáng 1–2 món, trưa và tối 3–4 món theo mâm cơm Việt (canh, mặn, rau/xào)

import { supabaseAdmin } from '../config/supabase.js';
import { getPersonalizedRecommendations } from '../services/recommendationService.js';
import { ApiError, requireConfirm, sendOk } from '../utils/http.js';
import {
  DAY_LABELS,
  MEALS,
  MEAL_LABELS,
  ROLES,
  addDays,
  buildPools,
  countUsage,
  isValidWeekStart,
  missingWarning,
  mondayOf,
  planMeal,
  planWeek,
  pickDish,
  todayVN,
} from '../utils/mealPlan.js';

const ITEM_FIELDS = 'id, day_index, meal, role, position, dish_id, dish:dishes(id, name, slug, image_url, category, cook_time_minutes, calories, is_published)';

function planNotFound() {
  return new ApiError(404, 'MEAL_PLAN_NOT_FOUND', 'Bạn chưa có thực đơn tuần. Hãy tạo gợi ý trước.');
}

function itemNotFound() {
  return new ApiError(404, 'MEAL_PLAN_ITEM_NOT_FOUND', 'Món không có trong thực đơn tuần của bạn.');
}

function validationError(field, message) {
  return new ApiError(422, 'VALIDATION_ERROR', message, [{ field, code: 'INVALID_VALUE', message }]);
}

/** Món ứng viên đã lọc an toàn (dị ứng, không thích, chế độ ăn bắt buộc, món bị chấm ≤ 2★) và chấm điểm theo hồ sơ. */
async function getCandidates(userId) {
  const { data, meta } = await getPersonalizedRecommendations({ userId, all: true });
  const candidates = (data || []).map((it) => ({ id: it.dish.id, category: it.dish.category, score: it.score }));
  return { pools: buildPools(candidates), personalized: meta?.strategy === 'personalized' };
}

async function findPlan(userId) {
  const { data, error } = await supabaseAdmin
    .from('meal_plans')
    .select('user_id, week_start, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchItems(userId) {
  const { data, error } = await supabaseAdmin
    .from('meal_plan_items')
    .select(ITEM_FIELDS)
    .eq('user_id', userId)
    .order('day_index')
    .order('position');
  if (error) throw error;
  return (data || []).filter((it) => it.dish);
}

function toItem(it) {
  return {
    id: it.id,
    role: it.role,
    role_label: ROLES[it.role]?.label || it.role,
    position: it.position,
    dish: {
      id: it.dish.id,
      name: it.dish.name,
      slug: it.dish.slug,
      image_url: it.dish.image_url,
      category: it.dish.category,
      cook_time_minutes: it.dish.cook_time_minutes,
      calories: it.dish.calories != null ? Number(it.dish.calories) : null,
      is_available: Boolean(it.dish.is_published),
    },
  };
}

/** Cấu trúc trả về chung của mục GET /me/meal-plan. */
export async function loadMealPlan(userId, { warnings = [], personalized } = {}) {
  const plan = await findPlan(userId);
  if (!plan) {
    return { week_start: null, week_end: null, days: [], summary: { dish_count: 0, item_count: 0, unavailable_count: 0 }, warnings };
  }
  const items = await fetchItems(userId);
  const days = DAY_LABELS.map((label, dayIndex) => ({
    day_index: dayIndex,
    date: addDays(plan.week_start, dayIndex),
    label,
    meals: MEALS.map((meal) => ({
      meal,
      label: MEAL_LABELS[meal],
      items: items.filter((it) => it.day_index === dayIndex && it.meal === meal).map(toItem),
    })),
  }));
  return {
    week_start: plan.week_start,
    week_end: addDays(plan.week_start, 6),
    days,
    summary: {
      dish_count: new Set(items.map((it) => it.dish_id)).size,
      item_count: items.length,
      unavailable_count: items.filter((it) => !it.dish.is_published).length,
    },
    ...(personalized !== undefined ? { personalized } : {}),
    warnings,
  };
}

function readWeekStart(body) {
  if (body?.week_start !== undefined) {
    if (!isValidWeekStart(body.week_start)) throw validationError('week_start', 'week_start phải là ngày Thứ Hai dạng YYYY-MM-DD.');
    return body.week_start;
  }
  const week = body?.week ?? 'current';
  if (week !== 'current' && week !== 'next') throw validationError('week', 'week chỉ nhận current hoặc next.');
  const monday = mondayOf(todayVN());
  return week === 'next' ? addDays(monday, 7) : monday;
}

function readDayMeal(params) {
  const day = Number(params.dayIndex);
  if (!Number.isInteger(day) || day < 0 || day > 6 || String(day) !== String(params.dayIndex)) {
    throw validationError('dayIndex', 'dayIndex phải từ 0 (Thứ Hai) đến 6 (Chủ Nhật).');
  }
  if (!MEALS.includes(params.meal)) throw validationError('meal', 'meal chỉ nhận breakfast, lunch hoặc dinner.');
  return { day, meal: params.meal };
}

function personalizationWarning(personalized) {
  return personalized ? [] : ['Hồ sơ khẩu vị còn ít thông tin nên thực đơn đang dựa trên món phổ biến. Hoàn thiện hồ sơ để gợi ý hợp khẩu vị hơn.'];
}

/** 4.15.1 Xem thực đơn tuần – GET /me/meal-plan */
export async function getMealPlan(req, res) {
  return sendOk(res, await loadMealPlan(req.user.id));
}

/** 4.15.2 Gợi ý thực đơn tuần – POST /me/meal-plan/generate (ghi đè thực đơn hiện tại) */
export async function generateMealPlan(req, res) {
  const weekStart = readWeekStart(req.body || {});
  const { pools, personalized } = await getCandidates(req.user.id);
  if (Object.values(pools).every((p) => p.length === 0)) {
    throw new ApiError(422, 'NO_SUITABLE_DISHES', 'Không có món nào phù hợp với hồ sơ khẩu vị của bạn để lập thực đơn.');
  }
  const { items, missingRoles } = planWeek(pools);

  const { error: upErr } = await supabaseAdmin
    .from('meal_plans')
    .upsert({ user_id: req.user.id, week_start: weekStart, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (upErr) throw upErr;
  const { error: delErr } = await supabaseAdmin.from('meal_plan_items').delete().eq('user_id', req.user.id);
  if (delErr) throw delErr;
  if (items.length > 0) {
    const { error } = await supabaseAdmin.from('meal_plan_items').insert(items.map((it) => ({ ...it, user_id: req.user.id })));
    if (error) throw error;
  }

  const warnings = [...personalizationWarning(personalized)];
  const missing = missingWarning(missingRoles);
  if (missing) warnings.push(missing);
  return sendOk(res, await loadMealPlan(req.user.id, { warnings, personalized }), { status: 201 });
}

/** 4.15.3 Gợi ý lại một bữa – POST /me/meal-plan/days/:dayIndex/meals/:meal/regenerate */
export async function regenerateMeal(req, res) {
  const { day, meal } = readDayMeal(req.params);
  if (!(await findPlan(req.user.id))) throw planNotFound();

  const all = await fetchItems(req.user.id);
  const current = all.filter((it) => it.day_index === day && it.meal === meal);
  const others = all.filter((it) => !(it.day_index === day && it.meal === meal));
  const usage = countUsage(others);
  const dayUsed = new Set(others.filter((it) => it.day_index === day).map((it) => it.dish_id));

  const { pools } = await getCandidates(req.user.id);
  const { items, missing } = planMeal(meal, pools, usage, dayUsed, { exclude: new Set(current.map((it) => it.dish_id)) });

  if (current.length > 0) {
    const { error } = await supabaseAdmin.from('meal_plan_items').delete().in('id', current.map((it) => it.id));
    if (error) throw error;
  }
  if (items.length > 0) {
    const { error } = await supabaseAdmin
      .from('meal_plan_items')
      .insert(items.map((it) => ({ ...it, day_index: day, meal, user_id: req.user.id })));
    if (error) throw error;
  }
  const warning = missingWarning(missing);
  return sendOk(res, await loadMealPlan(req.user.id, { warnings: warning ? [warning] : [] }));
}

async function findOwnItem(userId, rawId) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== String(rawId)) throw itemNotFound();
  const { data, error } = await supabaseAdmin
    .from('meal_plan_items')
    .select('id, user_id, day_index, meal, role, dish_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.user_id !== userId) throw itemNotFound();
  return data;
}

/** 4.15.4 Đổi món – POST /me/meal-plan/items/:itemId/swap (món khác cùng vai trò, không trùng món trong ngày) */
export async function swapMealItem(req, res) {
  const item = await findOwnItem(req.user.id, req.params.itemId);
  const all = await fetchItems(req.user.id);
  const others = all.filter((it) => it.id !== item.id);
  const usage = countUsage(others);
  const dayUsed = new Set(others.filter((it) => it.day_index === item.day_index).map((it) => it.dish_id));

  const { pools } = await getCandidates(req.user.id);
  const dishId = pickDish(pools[item.role] || [], { usage, dayUsed, exclude: new Set([item.dish_id]) });
  if (!dishId) {
    throw new ApiError(422, 'NO_ALTERNATIVE_DISH', 'Không còn món nào khác phù hợp để đổi.');
  }
  const { error } = await supabaseAdmin.from('meal_plan_items').update({ dish_id: dishId }).eq('id', item.id);
  if (error) throw error;
  return sendOk(res, await loadMealPlan(req.user.id));
}

/** 4.15.5 Gỡ món khỏi bữa – DELETE /me/meal-plan/items/:itemId */
export async function deleteMealItem(req, res) {
  const item = await findOwnItem(req.user.id, req.params.itemId);
  const { error } = await supabaseAdmin.from('meal_plan_items').delete().eq('id', item.id);
  if (error) throw error;
  return sendOk(res, await loadMealPlan(req.user.id));
}

/** 4.15.6 Xóa thực đơn tuần – DELETE /me/meal-plan?confirm=true */
export async function clearMealPlan(req, res) {
  requireConfirm(req.query.confirm);
  const { error } = await supabaseAdmin.from('meal_plans').delete().eq('user_id', req.user.id);
  if (error) throw error;
  return sendOk(res, await loadMealPlan(req.user.id));
}
