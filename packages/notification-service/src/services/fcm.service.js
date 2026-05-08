import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '@iuh-exchange/common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Firebase Cloud Messaging (FCM) push notification service.
 * 
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Generate a service account key (Project Settings > Service Accounts > Generate new private key)
 * 3. Save as `firebase-service-account.json` in the project root
 * 4. Set FIREBASE_PROJECT_ID in .env
 * 
 * For mobile apps, add `google-services.json` (Android) or `GoogleService-Info.plist` (iOS).
 */

let firebaseApp = null;
let messaging = null;

/**
 * Initialize Firebase Admin SDK.
 * Lazy-loaded: only initializes on first use if config is available.
 */
async function initFirebase() {
  if (firebaseApp) return messaging;

  try {
    // Dynamic import to avoid crash if firebase-admin is not installed
    const admin = await import('firebase-admin');
    
    // Try service account file first, then environment variables
    let credential;
    try {
      const serviceAccountPath = join(__dirname, '../../firebase-service-account.json');
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
      credential = admin.default.credential.cert(serviceAccount);
    } catch {
      // Fallback: use environment variables
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        credential = admin.default.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        });
      } else {
        logger.warn('Firebase credentials not found. Push notifications disabled.');
        return null;
      }
    }

    firebaseApp = admin.default.initializeApp({ credential });
    messaging = admin.default.messaging();
    logger.info('Firebase Cloud Messaging initialized');
    return messaging;
  } catch (err) {
    logger.warn(`Firebase init failed: ${err.message}. Push notifications disabled.`);
    return null;
  }
}

/**
 * Send push notification to a single device.
 * 
 * @param {string} fcmToken - Device FCM token
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Custom data key-value pairs
 * @returns {Promise<string|null>} - Message ID or null
 */
export async function sendPushNotification(fcmToken, notification, data = {}) {
  const msg = await initFirebase();
  if (!msg) {
    logger.debug('FCM not configured, skipping push notification');
    return null;
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.image && { image: notification.image }),
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'iuh-exchange',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: data.url || '/',
        },
      },
    };

    const messageId = await msg.send(message);
    logger.info(`FCM push sent: ${messageId} → ${fcmToken.substring(0, 20)}...`);
    return messageId;
  } catch (err) {
    logger.error(`FCM send failed: ${err.message}`);
    // Handle invalid tokens
    if (err.code === 'messaging/invalid-registration-token' || 
        err.code === 'messaging/registration-token-not-registered') {
      logger.warn(`Invalid FCM token, should remove: ${fcmToken.substring(0, 20)}...`);
    }
    return null;
  }
}

/**
 * Send push notification to multiple devices.
 * 
 * @param {string[]} fcmTokens - Array of device FCM tokens
 * @param {object} notification - { title, body, image? }
 * @param {object} data - Custom data key-value pairs
 * @returns {Promise<{successCount: number, failureCount: number, invalidTokens: string[]}>}
 */
export async function sendPushNotificationMulticast(fcmTokens, notification, data = {}) {
  const msg = await initFirebase();
  if (!msg || fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const message = {
      tokens: fcmTokens,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.image && { image: notification.image }),
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'iuh-exchange',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
        },
      },
    };

    const response = await msg.sendEachForMulticast(message);
    const invalidTokens = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const err = resp.error;
        if (err?.code === 'messaging/invalid-registration-token' ||
            err?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    logger.info(`FCM multicast: ${response.successCount} success, ${response.failureCount} failure out of ${fcmTokens.length}`);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (err) {
    logger.error(`FCM multicast failed: ${err.message}`);
    return { successCount: 0, failureCount: fcmTokens.length, invalidTokens: [] };
  }
}

/**
 * Send push notification to a topic.
 * 
 * @param {string} topic - FCM topic name
 * @param {object} notification - { title, body }
 * @param {object} data - Custom data
 */
export async function sendPushToTopic(topic, notification, data = {}) {
  const msg = await initFirebase();
  if (!msg) return null;

  try {
    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    const messageId = await msg.send(message);
    logger.info(`FCM topic push sent: ${messageId} → /topics/${topic}`);
    return messageId;
  } catch (err) {
    logger.error(`FCM topic push failed: ${err.message}`);
    return null;
  }
}
