import express from 'express';
import { getIngredients } from '../controllers/ingredientsController.js';

const router = express.Router();

router.get('/', getIngredients);

export default router;
