import { Router } from 'express';
import { getOrCreateLog, addFoodEntry, removeFoodEntry, addStudyEntry, removeStudyEntry, updateLog } from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', getOrCreateLog);
router.post('/:logId/food', addFoodEntry);
router.delete('/:logId/food/:entryId', removeFoodEntry);
router.post('/:logId/study', addStudyEntry);
router.delete('/:logId/study/:entryId', removeStudyEntry);
router.patch('/:logId', updateLog);

export default router;
