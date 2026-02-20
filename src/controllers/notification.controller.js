import prisma from '../config/db.js';

export async function subscribe(req, res, next) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.userId },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
