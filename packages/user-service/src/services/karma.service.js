import { User } from '../models/User.js';
import { KarmaHistory } from '../models/KarmaHistory.js';
import { logger, ResourceNotFoundException } from '@iuh-exchange/common';
import { publishUserEvent } from './kafka.service.js';

function normalizePermissions(permissions) {
  return Array.isArray(permissions) ? permissions : ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'];
}

export async function applyKarmaAdjustment({
  userId,
  amount,
  reason,
  source = 'SYSTEM',
  relatedId = null,
  performedBy = null,
  metadata = {},
}) {
  if (!userId || !Number.isFinite(Number(amount)) || Number(amount) === 0) return null;

  if (relatedId) {
    const existing = await KarmaHistory.findOne({ userId, relatedId, source }).lean();
    if (existing) {
      logger.info(`[Karma] Duplicate adjustment skipped: user=${userId}, source=${source}, related=${relatedId}`);
      return existing;
    }
  }

  const user = await User.findById(userId);
  if (!user) throw new ResourceNotFoundException('User', userId);

  const previousKarma = Number(user.karmaPoint ?? 100);
  const delta = Number(amount);
  user.karmaPoint = previousKarma + delta;
  user.permissions = normalizePermissions(user.permissions);

  if (user.karmaPoint < 0 && user.permissions.includes('CAN_POST')) {
    user.permissions = user.permissions.filter((permission) => permission !== 'CAN_POST');
  }
  if (user.karmaPoint >= 0 && !user.permissions.includes('CAN_POST')) {
    user.permissions.push('CAN_POST');
  }

  await user.save();

  const history = await KarmaHistory.create({
    userId,
    amount: delta,
    points: delta,
    previousKarma,
    newKarma: user.karmaPoint,
    reason: reason || 'Cập nhật karma',
    relatedId,
    performedBy,
    source,
    metadata,
  });

  await publishUserEvent('karma.updated', {
    id: history._id?.toString?.() || `${userId}:${source}:${relatedId || Date.now()}`,
    userId,
    karmaChange: delta,
    previousKarma,
    newKarma: user.karmaPoint,
    reason: reason || 'Cập nhật karma',
    source,
    relatedId,
  });

  return history;
}
