import { Router } from 'express';
import { getOrCreateLog, addFoodEntry, removeFoodEntry, addStudyEntry, removeStudyEntry, addSpendingEntry, removeSpendingEntry, updateLog } from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', getOrCreateLog);
router.post('/:logId/food', addFoodEntry);
router.delete('/:logId/food/:entryId', removeFoodEntry);
router.post('/:logId/study', addStudyEntry);
router.delete('/:logId/study/:entryId', removeStudyEntry);
router.post('/:logId/spending', addSpendingEntry);
router.delete('/:logId/spending/:entryId', removeSpendingEntry);
router.patch('/:logId', updateLog);

export default router;
