import prisma from '../config/db.js';
import { calculatePoints } from './points.controller.js';

const logIncludes = {
  entries: { include: { food: true } },
  studyEntries: { include: { subject: true } },
  spendingEntries: true,
};

async function recalcTotals(logId) {
  const entries = await prisma.foodLogEntry.findMany({
    where: { logId },
    include: { food: true },
  });
  const totalProtein = entries.reduce((s, e) => s + e.food.protein * e.servings, 0);
  const totalCalories = entries.reduce((s, e) => s + e.food.calories * e.servings, 0);
  const foodSpending = entries.reduce((s, e) => s + (e.cost ?? e.food.cost) * e.servings, 0);
  const spendingEntries = await prisma.spendingEntry.findMany({ where: { logId } });
  const extraSpending = spendingEntries.reduce((s, e) => s + e.amount, 0);
  const totalSpending = foodSpending + extraSpending;
  await prisma.dailyLog.update({
    where: { id: logId },
    data: { totalProtein, totalCalories, totalSpending },
  });
}

async function recalcStudyTotal(logId) {
  const entries = await prisma.studyLogEntry.findMany({ where: { logId } });
  const studyHours = entries.reduce((s, e) => s + e.hours, 0);
  await prisma.dailyLog.update({
    where: { id: logId },
    data: { studyHours },
  });
}

export async function getOrCreateLog(req, res, next) {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr + 'T00:00:00.000Z');

    let log = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: req.userId, date } },
      include: logIncludes,
    });

    if (!log) {
      log = await prisma.dailyLog.create({
        data: { userId: req.userId, date },
        include: logIncludes,
      });
    }

    res.json(log);
  } catch (err) { next(err); }
}

export async function addFoodEntry(req, res, next) {
  try {
    const { foodId, servings = 1, cost } = req.body;
    if (!foodId) return res.status(400).json({ error: 'foodId is required' });

    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    const data = { logId: log.id, foodId, servings };
    if (cost != null) data.cost = parseFloat(cost);

    await prisma.foodLogEntry.create({ data });

    await recalcTotals(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: logIncludes,
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
      include: logIncludes,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function addStudyEntry(req, res, next) {
  try {
    const { subjectId, hours = 0 } = req.body;
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });

    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.studyLogEntry.create({
      data: { logId: log.id, subjectId, hours: parseFloat(hours) || 0 },
    });

    await recalcStudyTotal(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: logIncludes,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function removeStudyEntry(req, res, next) {
  try {
    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.studyLogEntry.deleteMany({
      where: { id: req.params.entryId, logId: log.id },
    });

    await recalcStudyTotal(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: logIncludes,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function addSpendingEntry(req, res, next) {
  try {
    const { description, amount } = req.body;
    if (!description || amount == null) return res.status(400).json({ error: 'description and amount are required' });

    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.spendingEntry.create({
      data: { logId: log.id, description, amount: parseFloat(amount) || 0 },
    });

    await recalcTotals(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: logIncludes,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function removeSpendingEntry(req, res, next) {
  try {
    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    await prisma.spendingEntry.deleteMany({
      where: { id: req.params.entryId, logId: log.id },
    });

    await recalcTotals(log.id);
    calculatePoints(req.userId, log.date).catch(() => {});

    const updated = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: logIncludes,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function updateLog(req, res, next) {
  try {
    const log = await prisma.dailyLog.findUnique({ where: { id: req.params.logId } });
    if (!log || log.userId !== req.userId) return res.status(404).json({ error: 'Log not found' });

    const { exerciseMins } = req.body;
    const data = {};
    if (exerciseMins !== undefined) data.exerciseMins = parseFloat(exerciseMins) || 0;

    const updated = await prisma.dailyLog.update({
      where: { id: log.id },
      data,
      include: logIncludes,
    });
    calculatePoints(req.userId, log.date).catch(() => {});
    res.json(updated);
  } catch (err) { next(err); }
}
