import { User } from '../models/User.js';
import { KarmaHistory } from '../models/KarmaHistory.js';
import { logger, ResourceNotFoundException } from '@iuh-exchange/common';
import { publishUserEvent } from './kafka.service.js';
import { DEFAULT_KARMA, KARMA_PERMISSION_RULES } from './karma-policy.js';

function normalizePermissions(permissions) {
  return Array.isArray(permissions) ? permissions : ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'];
}

function syncPermissionsWithKarma(user) {
  const permissions = new Set(normalizePermissions(user.permissions));
  const karmaPoint = Number(user.karmaPoint ?? DEFAULT_KARMA);

  for (const { permission, minKarma } of KARMA_PERMISSION_RULES) {
    if (karmaPoint >= minKarma) {
      permissions.add(permission);
    } else {
      permissions.delete(permission);
    }
  }

  user.permissions = Array.from(permissions);
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

  const previousKarma = Number(user.karmaPoint ?? DEFAULT_KARMA);
  const delta = Number(amount);
  user.karmaPoint = previousKarma + delta;
  syncPermissionsWithKarma(user);

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

export { syncPermissionsWithKarma };
