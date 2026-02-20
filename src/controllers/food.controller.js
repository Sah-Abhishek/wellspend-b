import { z } from 'zod';
import prisma from '../config/db.js';

const foodSchema = z.object({
  name: z.string().min(1).max(100),
  protein: z.number().min(0).default(0),
  calories: z.number().min(0).default(0),
  cost: z.number().min(0).default(0),
  serving: z.string().default('1 serving'),
  emoji: z.string().default('🍽️'),
});

export async function listFoods(req, res, next) {
  try {
    const foods = await prisma.foodItem.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(foods);
  } catch (err) { next(err); }
}

export async function createFood(req, res, next) {
  try {
    const data = foodSchema.parse(req.body);
    const food = await prisma.foodItem.create({
      data: { ...data, userId: req.userId },
    });
    res.status(201).json(food);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
}

export async function updateFood(req, res, next) {
  try {
    const data = foodSchema.parse(req.body);
    const food = await prisma.foodItem.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data,
    });
    if (food.count === 0) return res.status(404).json({ error: 'Food not found' });
    const updated = await prisma.foodItem.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    next(err);
  }
}

export async function deleteFood(req, res, next) {
  try {
    await prisma.foodItem.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
