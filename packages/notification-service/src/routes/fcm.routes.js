import { Router } from 'express';
import { FcmToken } from '../models/FcmToken.js';
import { sendPushNotification, sendPushToTopic } from '../services/fcm.service.js';
import { ApiResponse, logger, authenticate } from '@iuh-exchange/common';

const router = Router();

// Bug #1 fix: All FCM routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/notifications/fcm/register
 * Register a device FCM token for push notifications.
 */
router.post('/fcm/register', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { token, deviceType = 'web', deviceName } = req.body;

    if (!userId || !token) {
      return res.status(400).json(ApiResponse.error('userId and token required'));
    }

    // Upsert: update if exists, create if not
    const existing = await FcmToken.findOne({ token });
    if (existing) {
      existing.userId = userId;
      existing.deviceType = deviceType;
      existing.deviceName = deviceName;
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      await existing.save();
    } else {
      await FcmToken.create({ userId, token, deviceType, deviceName });
    }

    logger.info(`FCM token registered for user ${userId} (${deviceType})`);
    res.json(ApiResponse.ok(null, 'Token registered'));
  } catch (err) {
    logger.error('FCM register error:', err);
    res.status(500).json(ApiResponse.error('Failed to register token'));
  }
});

/**
 * DELETE /api/v1/notifications/fcm/unregister
 * Remove a device FCM token.
 */
router.delete('/fcm/unregister', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json(ApiResponse.error('token required'));
    }

    await FcmToken.deleteOne({ token });
    logger.info('FCM token unregistered');
    res.json(ApiResponse.ok(null, 'Token unregistered'));
  } catch (err) {
    logger.error('FCM unregister error:', err);
    res.status(500).json(ApiResponse.error('Failed to unregister token'));
  }
});

/**
 * POST /api/v1/notifications/fcm/test
 * Send a test push notification to the current user.
 */
router.post('/fcm/test', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json(ApiResponse.error('userId required'));
    }

    const tokens = await FcmToken.find({ userId, isActive: true });
    if (tokens.length === 0) {
      return res.json(ApiResponse.ok({ sent: 0, message: 'No registered devices' }));
    }

    let sent = 0;
    for (const t of tokens) {
      const result = await sendPushNotification(t.token, {
        title: '🔔 IUH Exchange',
        body: 'Push notification test thành công!',
      });
      if (result) sent++;
    }

    res.json(ApiResponse.ok({ sent, total: tokens.length }));
  } catch (err) {
    logger.error('FCM test error:', err);
    res.status(500).json(ApiResponse.error('Failed to send test notification'));
  }
});

/**
 * POST /api/v1/notifications/fcm/subscribe-topic
 * Subscribe device to a topic.
 */
router.post('/fcm/subscribe-topic', async (req, res) => {
  try {
    const { token, topic } = req.body;
    if (!token || !topic) {
      return res.status(400).json(ApiResponse.error('token and topic required'));
    }

    const admin = await import('firebase-admin');
    await admin.default.messaging().subscribeToTopic(token, topic);
    logger.info(`FCM token subscribed to topic: ${topic}`);
    res.json(ApiResponse.ok(null, `Subscribed to ${topic}`));
  } catch (err) {
    logger.error('FCM subscribe topic error:', err);
    res.status(500).json(ApiResponse.error('Failed to subscribe'));
  }
});

export default router;
