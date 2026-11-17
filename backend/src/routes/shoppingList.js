// src/routes/shoppingList.js
// 4.15 Danh sách đi chợ (UC17) – gắn vào /me/shopping-list, đã qua authenticate ở routes/me.js

import { Router } from 'express';
import {
  addShoppingDish,
  addShoppingItem,
  clearShoppingList,
  deleteShoppingItem,
  getShoppingList,
  removeShoppingDish,
  updateShoppingDish,
  updateShoppingItem,
} from '../controllers/shoppingListController.js';
import { uuidParam } from '../utils/http.js';

const router = Router();
router.param('dishId', uuidParam('SHOPPING_DISH_NOT_FOUND', 'Món không có trong thực đơn.'));

router.get('/', getShoppingList);                         // 4.15.1
router.delete('/', clearShoppingList);                    // 4.15.8
router.post('/dishes', addShoppingDish);                  // 4.15.2
router.patch('/dishes/:dishId', updateShoppingDish);      // 4.15.3
router.delete('/dishes/:dishId', removeShoppingDish);     // 4.15.4
router.post('/items', addShoppingItem);                   // 4.15.5
router.patch('/items/:itemId', updateShoppingItem);       // 4.15.6
router.delete('/items/:itemId', deleteShoppingItem);      // 4.15.7

export default router;
