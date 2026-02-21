import { Router } from 'express';
import { createGroup, listGroups, getGroup, joinGroup, getLeaderboard, getMemberStats, getMemberLog, getWeeklyProgress, updateGroup, deleteGroup } from '../controllers/group.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', listGroups);
router.post('/', createGroup);
router.post('/join', joinGroup);
router.get('/:id', getGroup);
router.get('/:id/leaderboard', getLeaderboard);
router.get('/:id/weekly-progress', getWeeklyProgress);
router.get('/:id/members/:userId/stats', getMemberStats);
router.get('/:id/members/:userId/logs', getMemberLog);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

export default router;
