import { nanoid } from 'nanoid';
import prisma from '../config/db.js';
import { sendPushToGroup } from '../utils/pushNotification.js';

export async function createGroup(req, res, next) {
  try {
    const { name, goals = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

    const inviteCode = nanoid(8);
    const group = await prisma.group.create({
      data: {
        name,
        inviteCode,
        ownerId: req.userId,
        members: { create: { userId: req.userId } },
        goals: { create: goals.map(g => ({ category: g.category, target: parseFloat(g.target) || 0 })) },
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
