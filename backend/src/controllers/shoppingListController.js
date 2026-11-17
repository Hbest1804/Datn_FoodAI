// src/controllers/shoppingListController.js
// Danh sách đi chợ (UC17) – mục 4.15 của tài liệu API

import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, UUID_REGEX, requireConfirm, sendError, sendOk } from '../utils/http.js';
import {
  aggregateIngredients,
  diffAutoItems,
  displayQuantity,
  itemGroupKey,
  sortItems,
  summarize,
} from '../utils/shoppingList.js';

const MAX_SERVINGS = 100;
const MAX_MANUAL_ITEMS = 100;
const MAX_QUANTITY = 99999999.99; // numeric(10,2)

function validationError(field, message) {
  return new ApiError(422, 'VALIDATION_ERROR', message, [{ field, code: 'INVALID_VALUE', message }]);
}

function readServings(value, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError('servings', 'Số khẩu phần phải là số nguyên từ 1 đến 100.');
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SERVINGS) {
    throw validationError('servings', 'Số khẩu phần phải là số nguyên từ 1 đến 100.');
  }
  return n;
}

function readName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 100) throw validationError('name', 'Tên không được để trống và tối đa 100 ký tự.');
  return name;
}

function readQuantity(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_QUANTITY) throw validationError('quantity', 'Số lượng phải lớn hơn 0.');
  return Math.round(n * 100) / 100;
}

function readUnit(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw validationError('unit', 'Đơn vị tối đa 30 ký tự.');
  const unit = value.trim();
  if (unit.length > 30) throw validationError('unit', 'Đơn vị tối đa 30 ký tự.');
  return unit || null;
}

function readBool(value, field) {
  if (typeof value !== 'boolean') throw validationError(field, `${field} phải là true hoặc false.`);
  return value;
}

function parseItemId(raw) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && String(raw) === String(id) ? id : null;
}

function itemNotFound() {
  return new ApiError(404, 'SHOPPING_ITEM_NOT_FOUND', 'Dòng không tồn tại trong danh sách đi chợ của bạn.');
}

function dishNotInList() {
  return new ApiError(404, 'SHOPPING_DISH_NOT_FOUND', 'Món không có trong thực đơn.');
}

/**
 * Đọc danh sách đi chợ, đồng bộ dòng tự động với công thức hiện tại rồi trả đúng cấu trúc mục 4.15.1.
 * Món bị ẩn vẫn giữ (is_available = false) nhưng không tính nguyên liệu; món bị xóa hẳn đã tự gỡ nhờ cascade.
 */
export async function loadShoppingList(userId) {
  const [{ data: dishRows, error: dishErr }, { data: storedItems, error: itemErr }] = await Promise.all([
    supabaseAdmin
      .from('shopping_list_dishes')
      .select('dish_id, servings, added_at, dish:dishes(id, name, slug, image_url, servings, is_published)')
      .eq('user_id', userId)
      .order('added_at', { ascending: true }),
    supabaseAdmin
      .from('shopping_list_items')
      .select('id, is_manual, ingredient_id, unit_key, name, quantity, unit, have_at_home, purchased')
      .eq('user_id', userId),
  ]);
  if (dishErr) throw dishErr;
  if (itemErr) throw itemErr;

  const dishes = (dishRows || [])
    .filter((r) => r.dish)
    .map((r) => ({
      dish_id: r.dish_id,
      name: r.dish.name,
      slug: r.dish.slug,
      image_url: r.dish.image_url,
      servings: r.servings,
      recipe_servings: r.dish.servings,
      is_available: Boolean(r.dish.is_published),
    }));

  const available = dishes.filter((d) => d.is_available);
  let ingredientRows = [];
  if (available.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('dish_ingredients')
      .select('dish_id, ingredient_id, quantity, unit, is_optional, ingredient:ingredients(name)')
      .in('dish_id', available.map((d) => d.dish_id));
    if (error) throw error;
    ingredientRows = (data || []).map((r) => ({ ...r, ingredient_name: r.ingredient?.name || '' }));
  }
  const groups = aggregateIngredients(available, ingredientRows);

  // Đồng bộ dòng tự động: thêm nguyên liệu mới, xóa nguyên liệu không còn món nào dùng
  let autoItems = (storedItems || []).filter((it) => !it.is_manual);
  const manualItems = (storedItems || []).filter((it) => it.is_manual);
  const { toInsert, toDeleteIds } = diffAutoItems(autoItems, groups);
  if (toDeleteIds.length > 0) {
    const { error } = await supabaseAdmin.from('shopping_list_items').delete().in('id', toDeleteIds);
    if (error) throw error;
    autoItems = autoItems.filter((it) => !toDeleteIds.includes(it.id));
  }
  if (toInsert.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('shopping_list_items')
      .insert(toInsert.map((r) => ({ ...r, user_id: userId, is_manual: false })))
      .select('id, is_manual, ingredient_id, unit_key, name, quantity, unit, have_at_home, purchased');
    if (error) {
      // Hai yêu cầu đồng bộ cùng lúc: dòng đã được yêu cầu kia thêm, đọc lại là đủ
      if (error.code !== '23505') throw error;
      const { data: again, error: againErr } = await supabaseAdmin
        .from('shopping_list_items')
        .select('id, is_manual, ingredient_id, unit_key, name, quantity, unit, have_at_home, purchased')
        .eq('user_id', userId)
        .eq('is_manual', false);
      if (againErr) throw againErr;
      autoItems = again || [];
    } else {
      autoItems = autoItems.concat(data || []);
    }
  }

  const items = [
    ...autoItems
      .filter((it) => groups.has(itemGroupKey(it)))
      .map((it) => {
        const g = groups.get(itemGroupKey(it));
        const { quantity, unit } = displayQuantity(g.base_quantity, g.unit_key);
        return {
          id: it.id,
          is_manual: false,
          ingredient_id: it.ingredient_id,
          name: g.name,
          quantity,
          unit,
          is_optional: g.is_optional,
          used_by: g.used_by,
          have_at_home: it.have_at_home,
          purchased: it.purchased,
        };
      }),
    ...manualItems.map((it) => ({
      id: it.id,
      is_manual: true,
      ingredient_id: null,
      name: it.name,
      quantity: it.quantity == null ? null : Number(it.quantity),
      unit: it.unit,
      is_optional: false,
      used_by: [],
      have_at_home: it.have_at_home,
      purchased: it.purchased,
    })),
  ];

  const sorted = sortItems(items);
  return { dishes, items: sorted, summary: summarize(dishes, sorted) };
}

async function findListDish(userId, dishId) {
  const { data, error } = await supabaseAdmin
    .from('shopping_list_dishes')
    .select('dish_id, servings')
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findOwnItem(userId, rawId) {
  const id = parseItemId(rawId);
  if (!id) throw itemNotFound();
  const { data, error } = await supabaseAdmin
    .from('shopping_list_items')
    .select('id, user_id, is_manual')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.user_id !== userId) throw itemNotFound();
  return data;
}

/** 4.15.1 Xem danh sách đi chợ – GET /me/shopping-list */
export async function getShoppingList(req, res) {
  return sendOk(res, await loadShoppingList(req.user.id));
}

/** 4.15.2 Thêm món vào danh sách đi chợ – POST /me/shopping-list/dishes */
export async function addShoppingDish(req, res) {
  const body = req.body || {};
  const dishId = body.dish_id;
  if (typeof dishId !== 'string' || !UUID_REGEX.test(dishId)) {
    throw validationError('dish_id', 'dish_id phải là uuid.');
  }
  const servingsInput = readServings(body.servings, { required: false });
  const onExisting = body.on_existing;
  if (onExisting !== undefined && onExisting !== null && onExisting !== 'add' && onExisting !== 'replace') {
    throw validationError('on_existing', 'on_existing chỉ nhận add hoặc replace.');
  }

  const { data: dish, error: dishErr } = await supabaseAdmin
    .from('dishes')
    .select('id, name, servings, is_published')
    .eq('id', dishId)
    .maybeSingle();
  if (dishErr) throw dishErr;
  if (!dish?.is_published) return sendError(res, 404, 'DISH_NOT_FOUND', 'Món không tồn tại hoặc đã bị ẩn.');

  const [ings, steps] = await Promise.all([
    supabaseAdmin.from('dish_ingredients').select('*', { count: 'exact', head: true }).eq('dish_id', dish.id),
    supabaseAdmin.from('recipe_steps').select('*', { count: 'exact', head: true }).eq('dish_id', dish.id),
  ]);
  if (ings.error) throw ings.error;
  if (steps.error) throw steps.error;
  if (!ings.count || !steps.count) {
    return sendError(res, 422, 'RECIPE_REQUIRED', 'Món chưa có công thức nên chưa thể thêm vào thực đơn.');
  }

  const servings = servingsInput ?? Math.min(Math.max(dish.servings || 1, 1), MAX_SERVINGS);
  const existing = await findListDish(req.user.id, dish.id);

  let finalServings = servings;
  if (existing) {
    if (!onExisting) {
      return sendError(res, 409, 'SHOPPING_DISH_EXISTS', 'Món đã có trong thực đơn.', {
        current_servings: existing.servings,
      });
    }
    finalServings = onExisting === 'add' ? Math.min(existing.servings + servings, MAX_SERVINGS) : servings;
    const { error } = await supabaseAdmin
      .from('shopping_list_dishes')
      .update({ servings: finalServings })
      .eq('user_id', req.user.id)
      .eq('dish_id', dish.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('shopping_list_dishes')
      .insert({ user_id: req.user.id, dish_id: dish.id, servings });
    if (error) {
      if (error.code === '23505') {
        const current = await findListDish(req.user.id, dish.id);
        return sendError(res, 409, 'SHOPPING_DISH_EXISTS', 'Món đã có trong thực đơn.', {
          current_servings: current?.servings ?? servings,
        });
      }
      throw error;
    }
  }

  const list = await loadShoppingList(req.user.id);
  return sendOk(res, {
    dish: { dish_id: dish.id, name: dish.name, servings: finalServings },
    summary: { dish_count: list.summary.dish_count, to_buy: list.summary.to_buy },
  }, { status: existing ? 200 : 201 });
}

/** 4.15.3 Đổi số khẩu phần của món – PATCH /me/shopping-list/dishes/:dishId */
export async function updateShoppingDish(req, res) {
  const servings = readServings(req.body?.servings, { required: true });
  const { data, error } = await supabaseAdmin
    .from('shopping_list_dishes')
    .update({ servings })
    .eq('user_id', req.user.id)
    .eq('dish_id', req.params.dishId)
    .select('dish_id');
  if (error) throw error;
  if (!data || data.length === 0) throw dishNotInList();
  return sendOk(res, await loadShoppingList(req.user.id));
}

/** 4.15.4 Gỡ món khỏi danh sách – DELETE /me/shopping-list/dishes/:dishId */
export async function removeShoppingDish(req, res) {
  const { data, error } = await supabaseAdmin
    .from('shopping_list_dishes')
    .delete()
    .eq('user_id', req.user.id)
    .eq('dish_id', req.params.dishId)
    .select('dish_id');
  if (error) throw error;
  if (!data || data.length === 0) throw dishNotInList();
  return sendOk(res, await loadShoppingList(req.user.id));
}

/** 4.15.5 Thêm dòng thủ công – POST /me/shopping-list/items */
export async function addShoppingItem(req, res) {
  const body = req.body || {};
  const name = readName(body.name);
  const quantity = readQuantity(body.quantity);
  const unit = readUnit(body.unit);

  const { count, error: countErr } = await supabaseAdmin
    .from('shopping_list_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('is_manual', true);
  if (countErr) throw countErr;
  if ((count || 0) >= MAX_MANUAL_ITEMS) {
    return sendError(res, 422, 'SHOPPING_LIST_LIMIT', `Danh sách đã đủ ${MAX_MANUAL_ITEMS} dòng thủ công.`);
  }

  const { data: created, error } = await supabaseAdmin
    .from('shopping_list_items')
    .insert({ user_id: req.user.id, is_manual: true, name, quantity, unit })
    .select('id')
    .single();
  if (error) throw error;

  const list = await loadShoppingList(req.user.id);
  const item = list.items.find((it) => it.id === created.id);
  return sendOk(res, {
    item: {
      id: item.id,
      is_manual: true,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      have_at_home: item.have_at_home,
      purchased: item.purchased,
    },
    summary: list.summary,
  }, { status: 201 });
}

/** 4.15.6 Cập nhật dòng trong danh sách – PATCH /me/shopping-list/items/:itemId */
export async function updateShoppingItem(req, res) {
  const body = req.body || {};
  const item = await findOwnItem(req.user.id, req.params.itemId);

  const patch = {};
  if (body.have_at_home !== undefined) patch.have_at_home = readBool(body.have_at_home, 'have_at_home');
  if (body.purchased !== undefined) patch.purchased = readBool(body.purchased, 'purchased');
  const editsContent = ['name', 'quantity', 'unit'].some((f) => body[f] !== undefined);
  if (editsContent) {
    if (!item.is_manual) {
      return sendError(res, 422, 'ITEM_NOT_EDITABLE', 'Chỉ sửa được tên, số lượng, đơn vị của dòng thêm thủ công.');
    }
    if (body.name !== undefined) patch.name = readName(body.name);
    if (body.quantity !== undefined) patch.quantity = readQuantity(body.quantity);
    if (body.unit !== undefined) patch.unit = readUnit(body.unit);
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Không có trường nào để cập nhật.');
  }

  const { error } = await supabaseAdmin.from('shopping_list_items').update(patch).eq('id', item.id);
  if (error) throw error;

  const list = await loadShoppingList(req.user.id);
  const updated = list.items.find((it) => it.id === item.id);
  if (!updated) throw itemNotFound();
  return sendOk(res, { item: updated, summary: list.summary });
}

/** 4.15.7 Xóa dòng thủ công – DELETE /me/shopping-list/items/:itemId */
export async function deleteShoppingItem(req, res) {
  const item = await findOwnItem(req.user.id, req.params.itemId);
  if (!item.is_manual) {
    return sendError(res, 422, 'ITEM_NOT_MANUAL', 'Dòng tự động không xóa riêng được; hãy gỡ món dùng nguyên liệu này.');
  }
  const { error } = await supabaseAdmin.from('shopping_list_items').delete().eq('id', item.id);
  if (error) throw error;
  const list = await loadShoppingList(req.user.id);
  return sendOk(res, { id: item.id, deleted: true, summary: list.summary });
}

/** 4.15.8 Làm mới danh sách đi chợ – DELETE /me/shopping-list?confirm=true */
export async function clearShoppingList(req, res) {
  requireConfirm(req.query.confirm);
  const [dishes, items] = await Promise.all([
    supabaseAdmin.from('shopping_list_dishes').delete().eq('user_id', req.user.id),
    supabaseAdmin.from('shopping_list_items').delete().eq('user_id', req.user.id),
  ]);
  if (dishes.error) throw dishes.error;
  if (items.error) throw items.error;
  return sendOk(res, {
    dishes: [],
    items: [],
    summary: { dish_count: 0, to_buy: 0, have_at_home: 0, purchased: 0 },
  });
}
