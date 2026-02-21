import prisma from '../config/db.js';
import { sendPushToGroup } from '../utils/pushNotification.js';

const categoryToLogField = {
  protein: 'totalProtein',
  calories: 'totalCalories',
  spending: 'totalSpending',
  study: 'studyHours',
  exercise: 'exerciseMins',
};

export async function calculatePoints(userId, date) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: { goals: true } } },
  });

  if (memberships.length === 0) return;

  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!log) return;

  for (const membership of memberships) {
    const { group } = membership;
    let goalsHit = 0;

    const dailyGoals = group.goals.filter(g => g.type !== 'weekly');
    for (const goal of dailyGoals) {
      const field = categoryToLogField[goal.category];
      if (!field) continue;
      const value = log[field] || 0;
      // For spending, goal means "spend less than target"
      if (goal.category === 'spending') {
        if (value > 0 && value <= goal.target) goalsHit++;
      } else {
        if (value >= goal.target) goalsHit++;
      }
    }

    if (goalsHit > 0) {
      const existing = await prisma.pointEntry.findUnique({
        where: { userId_groupId_date: { userId, groupId: group.id, date } },
      });
      const previousGoals = existing?.points || 0;

      await prisma.pointEntry.upsert({
        where: { userId_groupId_date: { userId, groupId: group.id, date } },
        update: { points: goalsHit },
        create: { userId, groupId: group.id, date, points: goalsHit },
      });

      if (goalsHit > previousGoals) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        sendPushToGroup(group.id, {
          title: group.name,
          body: `${user.name} hit ${goalsHit} goal${goalsHit > 1 ? 's' : ''} today!`,
          url: `/app/groups/${group.id}`,
        }, userId).catch(() => {});
      }
    }
  }
}
