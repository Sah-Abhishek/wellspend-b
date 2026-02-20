import { Router } from 'express';
import { getOrCreateLog, addFoodEntry, removeFoodEntry, updateLog } from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', getOrCreateLog);
router.post('/:logId/food', addFoodEntry);
router.delete('/:logId/food/:entryId', removeFoodEntry);
router.patch('/:logId', updateLog);

export default router;
