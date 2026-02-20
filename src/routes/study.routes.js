import { Router } from 'express';
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../controllers/study.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', listSubjects);
router.post('/', createSubject);
router.put('/:id', updateSubject);
router.delete('/:id', deleteSubject);

export default router;
