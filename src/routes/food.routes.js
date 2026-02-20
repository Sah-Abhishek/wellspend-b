import { Router } from 'express';
import { listFoods, createFood, updateFood, deleteFood } from '../controllers/food.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', listFoods);
router.post('/', createFood);
router.put('/:id', updateFood);
router.delete('/:id', deleteFood);

export default router;
