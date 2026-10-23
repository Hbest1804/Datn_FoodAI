import express from 'express';
import { getFilters } from '../controllers/metaController.js';

const router = express.Router();

router.get('/filters', getFilters);

export default router;
