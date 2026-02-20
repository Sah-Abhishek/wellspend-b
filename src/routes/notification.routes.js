import { Router } from 'express';
import { subscribe, unsubscribe } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

export default router;
