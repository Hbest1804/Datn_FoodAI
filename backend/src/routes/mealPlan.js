// src/routes/mealPlan.js
// 4.15 Gợi ý thực đơn tuần (UC17) – gắn vào /me/meal-plan, đã qua authenticate ở routes/me.js

import { Router } from 'express';
import {
  clearMealPlan,
  deleteMealItem,
  generateMealPlan,
  getMealPlan,
  regenerateMeal,
  swapMealItem,
} from '../controllers/mealPlanController.js';

const router = Router();

router.get('/', getMealPlan);                                                  // 4.15.1
router.post('/generate', generateMealPlan);                                    // 4.15.2
router.post('/days/:dayIndex/meals/:meal/regenerate', regenerateMeal);         // 4.15.3
router.post('/items/:itemId/swap', swapMealItem);                              // 4.15.4
router.delete('/items/:itemId', deleteMealItem);                               // 4.15.5
router.delete('/', clearMealPlan);                                             // 4.15.6

export default router;
