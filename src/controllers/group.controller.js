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
