import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/db.js';
import { signToken } from '../utils/jwt.js';

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function signup(req, res, next) {
  try {
    const { email, name, password } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, password: hashed },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });

    const token = signToken({ userId: user.id });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ userId: user.id });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}
