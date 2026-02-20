import webpush from 'web-push';
import prisma from '../config/db.js';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushToUser(userId, payload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        throw err;
      }
    })
  );
  return results;
}

export async function sendPushToGroup(groupId, payload, excludeUserId) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const userIds = members
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);

  await Promise.allSettled(userIds.map((uid) => sendPushToUser(uid, payload)));
}
