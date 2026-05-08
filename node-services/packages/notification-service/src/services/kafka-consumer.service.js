import { createConsumer, logger } from '@iuh-exchange/common';
import { Notification } from '../models/Notification.js';

const GROUP_ID = 'notification-service-group';

const TOPICS = [
  { topic: 'order.created', fromBeginning: false },
  { topic: 'order.completed', fromBeginning: false },
  { topic: 'order.cancelled', fromBeginning: false },
  { topic: 'product.reserved', fromBeginning: false },
  { topic: 'karma.updated', fromBeginning: false },
  { topic: 'report.created', fromBeginning: false },
];

/**
 * Create and persist a notification, then emit it via Socket.IO.
 *
 * @param {object} params
 * @param {string} params.recipientId
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} params.type - ORDER | CHAT | SYSTEM | KARMA | REPORT
 * @param {string} [params.targetId]
 * @param {import('socket.io').Server} params.io
 */
async function sendNotification({ recipientId, title, message, type, targetId, io }) {
  if (!recipientId) return;

  const notification = await Notification.create({
    recipientId,
    title,
    message,
    type,
    targetId: targetId || null,
  });

  const notificationObj = notification.toObject();

  // Push real-time via Socket.IO to the user's personal room
  if (io) {
    io.to(`user:${recipientId}`).emit('notification:new', notificationObj);
  }

  logger.info(`Notification sent to ${recipientId}: ${title}`);
  return notificationObj;
}

/**
 * Event handlers mapping.
 * Each handler extracts relevant fields from the Kafka message payload
 * and calls sendNotification for each recipient.
 */
const eventHandlers = {
  'order.created': async (payload, io) => {
    const { sellerId, orderId, buyerName } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'New Order',
      message: `You have a new purchase request for order ${orderId}${buyerName ? ` from ${buyerName}` : ''}`,
      type: 'ORDER',
      targetId: orderId,
      io,
    });
  },

  'order.completed': async (payload, io) => {
    const { buyerId, sellerId, orderId } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Transaction Complete',
        message: `Order ${orderId} has been completed successfully!`,
        type: 'ORDER',
        targetId: orderId,
        io,
      });
    }
  },

  'order.cancelled': async (payload, io) => {
    const { buyerId, sellerId, orderId, reason } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Order Cancelled',
        message: `Order ${orderId} has been cancelled${reason ? `: ${reason}` : ''}`,
        type: 'ORDER',
        targetId: orderId,
        io,
      });
    }
  },

  'product.reserved': async (payload, io) => {
    const { sellerId, productId, buyerName } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'Product Reserved',
      message: `Your product has been reserved${buyerName ? ` by ${buyerName}` : ''}`,
      type: 'ORDER',
      targetId: productId,
      io,
    });
  },

  'karma.updated': async (payload, io) => {
    const { userId, karmaChange, reason } = payload;
    const direction = karmaChange >= 0 ? 'increased' : 'decreased';
    await sendNotification({
      recipientId: userId,
      title: 'Karma Updated',
      message: `Your karma has ${direction} by ${Math.abs(karmaChange)}${reason ? `. Reason: ${reason}` : ''}`,
      type: 'KARMA',
      targetId: userId,
      io,
    });
  },

  'report.created': async (payload, io) => {
    const { reporterId, reportedUserId, reportId } = payload;
    await sendNotification({
      recipientId: reporterId,
      title: 'Report Submitted',
      message: `Your report #${reportId} has been submitted and is under review`,
      type: 'REPORT',
      targetId: reportId,
      io,
    });
    if (reportedUserId) {
      await sendNotification({
        recipientId: reportedUserId,
        title: 'Account Under Review',
        message: 'Your account has been flagged for review',
        type: 'REPORT',
        targetId: reportId,
        io,
      });
    }
  },
};

/**
 * Start the Kafka consumer.
 * Each incoming message is parsed as JSON and dispatched to the matching handler.
 *
 * @param {import('socket.io').Server} io - Socket.IO instance for real-time push
 */
export async function startKafkaConsumer(io) {
  try {
    const consumer = await createConsumer(GROUP_ID, TOPICS, 'notification-service');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const rawValue = message.value?.toString();
          if (!rawValue) return;

          const payload = JSON.parse(rawValue);
          logger.info(`Kafka message received`, { topic, partition, offset: message.offset });

          const handler = eventHandlers[topic];
          if (handler) {
            await handler(payload, io);
          } else {
            logger.warn(`No handler for topic: ${topic}`);
          }
        } catch (err) {
          logger.error(`Error processing Kafka message from ${topic}`, {
            error: err.message,
            partition,
            offset: message.offset,
          });
        }
      },
    });

    logger.info(`Kafka consumer started: group=${GROUP_ID}, topics=${TOPICS.map((t) => t.topic).join(', ')}`);
  } catch (err) {
    logger.error('Failed to start Kafka consumer', { error: err.message });
    throw err;
  }
}
