import { nanoid } from 'nanoid';
import prisma from '../config/db.js';
import { sendPushToGroup } from '../utils/pushNotification.js';

export async function createGroup(req, res, next) {
  try {
    const { name, goals = [], weeklyGoals = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

    const inviteCode = nanoid(8);
    const allGoals = [
      ...goals.map(g => ({ category: g.category, target: parseFloat(g.target) || 0, type: 'daily' })),
      ...weeklyGoals.map(g => ({ category: g.category, target: parseFloat(g.target) || 0, type: 'weekly' })),
    ];
    const group = await prisma.group.create({
      data: {
        name,
        inviteCode,
        ownerId: req.userId,
        members: { create: { userId: req.userId } },
        goals: { create: allGoals },
      },
      include: { goals: true, members: true },
    });
    res.status(201).json(group);
  } catch (err) { next(err); }
}

export async function listGroups(req, res, next) {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
            goals: true,
          },
        },
      },
    });

    const groups = await Promise.all(memberships.map(async (m) => {
      const points = await prisma.pointEntry.aggregate({
        where: { userId: req.userId, groupId: m.groupId },
        _sum: { points: true },
      });
      return {
        ...m.group,
        memberCount: m.group._count.members,
        userPoints: points._sum.points || 0,
      };
    }));

    res.json(groups);
  } catch (err) { next(err); }
}

export async function getGroup(req, res, next) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        goals: true,
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) { next(err); }
}

export async function joinGroup(req, res, next) {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) return res.status(404).json({ error: 'Invalid invite code' });

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId: group.id } },
    });
    if (existing) return res.json(group);

    await prisma.groupMember.create({
      data: { userId: req.userId, groupId: group.id },
    });

    // Notify group members about new join
    const joiner = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    sendPushToGroup(group.id, {
      title: group.name,
      body: `${joiner.name} joined the group!`,
      url: `/app/groups/${group.id}`,
    }, req.userId).catch(() => {});

    res.json(group);
  } catch (err) { next(err); }
}

export async function getLeaderboard(req, res, next) {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id },
      include: { user: { select: { id: true, name: true } } },
    });

    const leaderboard = await Promise.all(members.map(async (m) => {
      const points = await prisma.pointEntry.aggregate({
        where: { userId: m.userId, groupId: req.params.id },
        _sum: { points: true },
      });
      return {
        userId: m.userId,
        userName: m.user.name,
        totalPoints: points._sum.points || 0,
      };
    }));

    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    res.json(leaderboard);
  } catch (err) { next(err); }
}

export async function getMemberStats(req, res, next) {
  try {
    const groupId = req.params.id;
    const targetUserId = req.params.userId;

    // Validate requesting user is a member
    const requesterMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } },
    });
    if (!requesterMember) return res.status(403).json({ error: 'You are not a member of this group' });

    // Validate target user is a member
    const targetMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!targetMember) return res.status(404).json({ error: 'User is not a member of this group' });

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
        userId: targetUserId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

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

export async function getMemberLog(req, res, next) {
  try {
    const groupId = req.params.id;
    const targetUserId = req.params.userId;

    // Validate requesting user is a member
    const requesterMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId, groupId } },
    });
    if (!requesterMember) return res.status(403).json({ error: 'You are not a member of this group' });

    // Validate target user is a member
    const targetMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!targetMember) return res.status(404).json({ error: 'User is not a member of this group' });

    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr + 'T00:00:00.000Z');

    const log = await prisma.dailyLog.findUnique({
      where: { userId_date: { userId: targetUserId, date } },
      include: { entries: { include: { food: true } } },
    });

    res.json(log || { date: dateStr, totalProtein: 0, totalCalories: 0, totalSpending: 0, studyHours: 0, exerciseMins: 0, entries: [] });
  } catch (err) { next(err); }
}

const categoryToLogField = {
  protein: 'totalProtein',
  calories: 'totalCalories',
  spending: 'totalSpending',
  study: 'studyHours',
  exercise: 'exerciseMins',
};

export async function getWeeklyProgress(req, res, next) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        goals: { where: { type: 'weekly' } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.goals.length === 0) return res.json([]);

    // Calculate current week boundaries (Mon 00:00 → Sun 23:59 UTC)
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMon));
    const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999));

    const memberIds = group.members.map(m => m.userId);

    // Batch fetch all daily logs for the week for all members
    const logs = await prisma.dailyLog.findMany({
      where: {
        userId: { in: memberIds },
        date: { gte: monday, lte: sunday },
      },
    });

    // Compute per-member sums
    const memberSums = {};
    for (const m of group.members) {
      memberSums[m.userId] = { userName: m.user.name };
      for (const cat of Object.keys(categoryToLogField)) {
        memberSums[m.userId][cat] = 0;
      }
    }
    for (const log of logs) {
      if (!memberSums[log.userId]) continue;
      for (const [cat, field] of Object.entries(categoryToLogField)) {
        memberSums[log.userId][cat] += log[field] || 0;
      }
    }

    // Build response: one entry per weekly goal
    const result = group.goals.map(goal => {
      const members = group.members.map(m => {
        const current = memberSums[m.userId][goal.category] || 0;
        let percent;
        if (goal.target <= 0) {
          percent = 0;
        } else if (goal.category === 'spending') {
          // Spending: 100% if at/under budget, decreasing if over
          percent = current === 0 ? 100 : current <= goal.target ? 100 : Math.round((goal.target / current) * 100);
        } else {
          percent = Math.min(100, Math.round((current / goal.target) * 100));
        }
        return {
          userId: m.userId,
          userName: m.user.name,
          current: Math.round(current * 10) / 10,
          percent,
        };
      });
      return {
        goalId: goal.id,
        category: goal.category,
        target: goal.target,
        members,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function updateGroup(req, res, next) {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group || group.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Only the owner can edit this group' });
    }

    const { name, goals = [], weeklyGoals = [] } = req.body;

    // Update group name if provided
    if (name?.trim()) {
      await prisma.group.update({ where: { id: group.id }, data: { name: name.trim() } });
    }

    // Delete all existing goals, then recreate
    await prisma.groupGoal.deleteMany({ where: { groupId: group.id } });

    const allGoals = [
      ...goals.map(g => ({ category: g.category, target: parseFloat(g.target) || 0, type: 'daily', groupId: group.id })),
      ...weeklyGoals.map(g => ({ category: g.category, target: parseFloat(g.target) || 0, type: 'weekly', groupId: group.id })),
    ];
    if (allGoals.length > 0) {
      await prisma.groupGoal.createMany({ data: allGoals });
    }

    // Return updated group
    const updated = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        goals: true,
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function deleteGroup(req, res, next) {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group || group.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Only the owner can delete this group' });
    }
    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
