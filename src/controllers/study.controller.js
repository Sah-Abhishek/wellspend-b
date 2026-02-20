import { z } from 'zod';
import prisma from '../config/db.js';

const subjectSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().default('book'),
});

export async function listSubjects(req, res, next) {
  try {
    const subjects = await prisma.studySubject.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(subjects);
  } catch (err) { next(err); }
}

export async function createSubject(req, res, next) {
  try {
    const data = subjectSchema.parse(req.body);
    const subject = await prisma.studySubject.create({
      data: { ...data, userId: req.userId },
    });
    res.status(201).json(subject);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
}

export async function updateSubject(req, res, next) {
  try {
    const data = subjectSchema.parse(req.body);
    const subject = await prisma.studySubject.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data,
    });
    if (subject.count === 0) return res.status(404).json({ error: 'Subject not found' });
    const updated = await prisma.studySubject.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
}

export async function deleteSubject(req, res, next) {
  try {
    await prisma.studySubject.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
