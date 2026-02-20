import prisma from '../config/db.js';

export async function getStats(req, res, next) {
  try {
    const range = req.query.range || 'week';
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const endDate = new Date(dateStr + 'T23:59:59.999Z');

    let startDate;
    if (range === 'month') {
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 29);
    } else {
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
    }
    startDate.setHours(0, 0, 0, 0);

    const logs = await prisma.dailyLog.findMany({
      where: {
        userId: req.userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Fill in missing days with zeros
    const result = [];
    const d = new Date(startDate);
    while (d <= endDate) {
      const dayStr = d.toISOString().split('T')[0];
      const log = logs.find(l => l.date.toISOString().split('T')[0] === dayStr);
      result.push({
        date: dayStr,
        totalProtein: log?.totalProtein || 0,
        totalCalories: log?.totalCalories || 0,
        totalSpending: log?.totalSpending || 0,
        studyHours: log?.studyHours || 0,
        exerciseMins: log?.exerciseMins || 0,
      });
      d.setDate(d.getDate() + 1);
    }

    res.json(result);
  } catch (err) { next(err); }
}
