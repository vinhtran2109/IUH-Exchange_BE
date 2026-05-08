import { createRedis, logger } from '@iuh-exchange/common';

const REDIS_NOTIF_CHANNEL = 'sockjs:notifications';

let redisPublisher = null;

/**
 * Initialize the notification service's Redis publisher.
 * Notifications are published to Redis and consumed by the chat-service
 * which has the active WebSocket (SockJS + STOMP) connections.
 *
 * @returns {{ publishNotification: Function }}
 */
export function initNotificationSocket() {
  redisPublisher = createRedis();

  logger.info('Notification service initialized — publishing via Redis pub/sub');

  return { publishNotification };
}

/**
 * Publish a notification object to Redis for cross-instance delivery.
 * The chat-service subscribes to this channel and pushes to connected users.
 *
 * @param {object} notification - Mongoose notification document (plain object)
 */
export function publishNotification(notification) {
  if (!redisPublisher) {
    logger.warn('Redis publisher not initialized, cannot publish notification');
    return;
  }

  try {
    redisPublisher.publish(REDIS_NOTIF_CHANNEL, JSON.stringify(notification));
    logger.info(`Notification published to Redis for recipient ${notification.recipientId}`);
  } catch (err) {
    logger.error('Failed to publish notification to Redis', { error: err.message });
  }
}
