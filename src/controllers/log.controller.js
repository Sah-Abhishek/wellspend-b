import prisma from '../config/db.js';
import { calculatePoints } from './points.controller.js';

async function recalcTotals(logId) {
  const entries = await prisma.foodLogEntry.findMany({
    where: { logId },
    include: { food: true },
  });
  const totalProtein = entries.reduce((s, e) => s + e.food.protein * e.servings, 0);
  const totalCalories = entries.reduce((s, e) => s + e.food.calories * e.servings, 0);
  const totalSpending = entries.reduce((s, e) => s + e.food.cost * e.servings, 0);
  await prisma.dailyLog.update({
    where: { id: logId },
    data: { totalProtein, totalCalories, totalSpending },
  });
}

export async function getOrCreateLog(req, res, next) {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr + 'T00:00:00.000Z');

    let log = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: req.userId, date } },
      include: { entries: { include: { food: true } } },
    });

    if (!log) {
      log = await prisma.dailyLog.create({
        data: { userId: req.userId, date },
        include: { entries: { include: { food: true } } },
      });
    }

    res.json(log);
  } catch (err) { next(err); }
}

export async function addFoodEntry(req, res, next) {
  try {
    const { foodId, servings = 1 } = req.body;
    if (!foodId) return res.status(400).json({ error: 'foodId is required' });

    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.foodLogEntry.create({
      data: { logId: log.id, foodId, servings },
    });

    await recalcTotals(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: { entries: { include: { food: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function removeFoodEntry(req, res, next) {
  try {
    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.foodLogEntry.deleteMany({
      where: { id: req.params.entryId, logId: log.id },
    });

    await recalcTotals(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: { entries: { include: { food: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function updateLog(req, res, next) {
  try {
    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    const { studyHours, exerciseMins } = req.body;
    const data = {};
    if (studyHours !== undefined) data.studyHours = parseFloat(studyHours) || 0;
    if (exerciseMins !== undefined) data.exerciseMins = parseFloat(exerciseMins) || 0;

    const updated = await prisma.dailyLog.update({
      where: { id: log.id },
      data,
      include: { entries: { include: { food: true } } },
    });
    calculatePoints(req.userId, log.date).catch(() => {});
    res.json(updated);
  } catch (err) { next(err); }
}
