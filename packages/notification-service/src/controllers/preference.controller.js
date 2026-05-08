import { NotificationPreference } from '../models/NotificationPreference.js';
import { ApiResponse, logger } from '@iuh-exchange/common';

/**
 * GET /api/v1/notifications/preferences
 * Get notification preferences for the authenticated user.
 * Creates default preferences if none exist.
 */
export async function getPreferences(req, res, next) {
  try {
    const userId = req.user.sub;

    let prefs = await NotificationPreference.findOne({ userId }).lean();

    if (!prefs) {
      // Create default preferences on first access
      prefs = await NotificationPreference.create({ userId });
      prefs = prefs.toObject();
    }

    res.json(ApiResponse.ok(prefs));
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/notifications/preferences
 * Update notification preferences for the authenticated user.
 *
 * Body: {
 *   email?: { ORDER?: bool, CHAT?: bool, SYSTEM?: bool, KARMA?: bool, REPORT?: bool, PRODUCT?: bool },
 *   push?: { ORDER?: bool, CHAT?: bool, SYSTEM?: bool, KARMA?: bool, REPORT?: bool, PRODUCT?: bool },
 *   inApp?: { ORDER?: bool, CHAT?: bool, SYSTEM?: bool, KARMA?: bool, REPORT?: bool, PRODUCT?: bool }
 * }
 */
export async function updatePreferences(req, res, next) {
  try {
    const userId = req.user.sub;
    const { email, push, inApp } = req.body;

    const validTypes = ['ORDER', 'CHAT', 'SYSTEM', 'KARMA', 'REPORT', 'PRODUCT'];

    // Validate keys
    for (const channel of [email, push, inApp].filter(Boolean)) {
      for (const key of Object.keys(channel)) {
        if (!validTypes.includes(key)) {
          return res.status(400).json(ApiResponse.error(400, `Invalid notification type: ${key}. Must be one of: ${validTypes.join(', ')}`));
        }
        if (typeof channel[key] !== 'boolean') {
          return res.status(400).json(ApiResponse.error(400, `Value for ${key} must be a boolean`));
        }
      }
    }

    // Find or create preferences
    let prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) {
      prefs = new NotificationPreference({ userId });
    }

    // Merge updates
    if (email) Object.assign(prefs.email, email);
    if (push) Object.assign(prefs.push, push);
    if (inApp) Object.assign(prefs.inApp, inApp);

    await prefs.save();

    logger.info(`Notification preferences updated for user: ${userId}`);
    res.json(ApiResponse.ok(prefs.toObject(), 'Cập nhật tùy chọn thông báo thành công'));
  } catch (err) {
    next(err);
  }
}
