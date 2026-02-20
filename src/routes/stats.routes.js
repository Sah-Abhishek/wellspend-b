import { Router } from 'express';
import { getStats } from '../controllers/stats.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', getStats);

export default router;
