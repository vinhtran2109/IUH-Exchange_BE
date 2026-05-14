import { createConsumer, logger } from '@iuh-exchange/common';
import { Notification } from '../models/Notification.js';
import { DlqEvent } from '../models/DlqEvent.js';
import { FcmToken } from '../models/FcmToken.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { publishNotification } from './socket.service.js';
import { sendOrderEmail } from './email.service.js';
import { sendPushNotification } from './fcm.service.js';

const GROUP_ID = 'notification-service-group';

const TOPICS = [
  { topic: 'order.created', fromBeginning: false },
  { topic: 'order.completed', fromBeginning: false },
  { topic: 'order.cancelled', fromBeginning: false },
  { topic: 'order.dispute.opened', fromBeginning: false },
  { topic: 'order.refunded', fromBeginning: false },
  { topic: 'product.reserved', fromBeginning: false },
  { topic: 'product.approved', fromBeginning: false },
  { topic: 'product.rejected', fromBeginning: false },
  { topic: 'karma.updated', fromBeginning: false },
  { topic: 'report.created', fromBeginning: false },
];

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

/**
 * Fetch user email from user-service (internal call).
 */
async function getUserEmail(userId) {
  try {
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/users/${userId}`);
    const data = await res.json();
    return data?.data?.email || null;
  } catch {
    return null;
  }
}

/**
 * Create and persist a notification, then publish it via Redis pub/sub.
 * The chat-service picks it up and delivers to connected WebSocket clients.
 *
 * @param {object} params
 * @param {string} params.recipientId
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} params.type - ORDER | CHAT | SYSTEM | KARMA | REPORT
 * @param {string} [params.targetId]
 */
async function sendNotification({ recipientId, title, message, type, targetId }) {
  if (!recipientId) return;

  // Check user's notification preferences
  let shouldSendInApp = true;
  let shouldSendPush = true;
  let shouldSendEmail = true;

  try {
    const prefs = await NotificationPreference.findOne({ userId: recipientId }).lean();
    if (prefs) {
      shouldSendInApp = prefs.inApp?.[type] !== false; // default true
      shouldSendPush = prefs.push?.[type] !== false;
      shouldSendEmail = prefs.email?.[type] !== false;
    }
  } catch (prefErr) {
    logger.warn(`Failed to check notification preferences for ${recipientId}: ${prefErr.message}`);
  }

  // Always create notification record (for in-app display if enabled)
  const notification = await Notification.create({
    recipientId,
    title,
    message,
    type,
    targetId: targetId || null,
  });

  const notificationObj = notification.toObject();

  // Publish to Redis for WebSocket delivery (if in-app enabled)
  if (shouldSendInApp) {
    publishNotification(notificationObj);
  }

  // Send FCM push notification (if push enabled)
  if (shouldSendPush) {
    try {
      const tokens = await FcmToken.find({ userId: recipientId, isActive: true });
      for (const t of tokens) {
        await sendPushNotification(t.token, { title, body: message }, {
          type,
          targetId: targetId || '',
          notificationId: notificationObj._id?.toString() || '',
        });
      }
    } catch (fcmErr) {
      logger.warn(`FCM push failed for ${recipientId}: ${fcmErr.message}`);
    }
  }

  logger.info(`Notification sent to ${recipientId}: ${title} [inApp=${shouldSendInApp}, push=${shouldSendPush}, email=${shouldSendEmail}]`);
  return { notificationObj, shouldSendEmail };
}

/**
 * Event handlers mapping.
 * Each handler extracts relevant fields from the Kafka message payload
 * and calls sendNotification for each recipient.
 */
const eventHandlers = {
  'order.created': async (payload) => {
    const { sellerId, orderId, buyerName } = payload;
    const { shouldSendEmail } = await sendNotification({
      recipientId: sellerId,
      title: 'New Order',
      message: `You have a new purchase request for order ${orderId}${buyerName ? ` from ${buyerName}` : ''}`,
      type: 'ORDER',
      targetId: orderId,
    });
    // Send email (respect preference)
    if (shouldSendEmail) {
      const email = await getUserEmail(sellerId);
      if (email) {
        await sendOrderEmail(email, {
          subject: 'Đơn hàng mới',
          title: 'Bạn có đơn hàng mới!',
          body: `Một người mua vừa gửi yêu cầu mua sản phẩm của bạn. Vui lòng kiểm tra và xác nhận đơn hàng.`,
          orderId,
          status: 'Chờ xác nhận',
        });
      }
    }
  },

  'order.completed': async (payload) => {
    const { buyerId, sellerId, orderId } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      const { shouldSendEmail } = await sendNotification({
        recipientId,
        title: 'Transaction Complete',
        message: `Order ${orderId} has been completed successfully!`,
        type: 'ORDER',
        targetId: orderId,
      });
      if (shouldSendEmail) {
        const email = await getUserEmail(recipientId);
        if (email) {
          await sendOrderEmail(email, {
            subject: 'Giao dịch thành công',
            title: 'Giao dịch hoàn tất! 🎉',
            body: `Đơn hàng #${orderId.substring(0, 8)} đã được xác nhận hoàn tất. Cảm ơn bạn đã sử dụng ${process.env.APP_NAME || 'IUH Exchange'}!`,
            orderId,
            status: 'Hoàn tất',
          });
        }
      }
    }
  },

  'order.cancelled': async (payload) => {
    const { buyerId, sellerId, orderId, reason } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      const { shouldSendEmail } = await sendNotification({
        recipientId,
        title: 'Order Cancelled',
        message: `Order ${orderId} has been cancelled${reason ? `: ${reason}` : ''}`,
        type: 'ORDER',
        targetId: orderId,
      });
      if (shouldSendEmail) {
        const email = await getUserEmail(recipientId);
        if (email) {
          await sendOrderEmail(email, {
            subject: 'Đơn hàng đã bị hủy',
            title: 'Đơn hàng bị hủy',
            body: `Đơn hàng #${orderId.substring(0, 8)} đã bị hủy.${reason ? ` Lý do: ${reason}` : ''}`,
            orderId,
            status: 'Đã hủy',
          });
        }
      }
    }
  },

  'order.dispute.opened': async (payload) => {
    const { buyerId, sellerId, orderId, reason, openedBy } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Tranh chấp đơn hàng',
        message: `Đơn hàng ${orderId} vừa được mở tranh chấp${openedBy ? ` bởi ${openedBy}` : ''}${reason ? `: ${reason}` : ''}`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.refunded': async (payload) => {
    const { buyerId, sellerId, orderId, amount } = payload;
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Hoàn tiền đơn hàng',
        message: `Đơn hàng ${orderId} đã được hoàn tiền${amount ? ` ${Number(amount).toLocaleString('vi-VN')}đ` : ''}`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'product.reserved': async (payload) => {
    const { sellerId, productId, buyerName } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'Product Reserved',
      message: `Your product has been reserved${buyerName ? ` by ${buyerName}` : ''}`,
      type: 'ORDER',
      targetId: productId,
    });
  },

  'product.approved': async (payload) => {
    const { sellerId, productId, productTitle } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'Sản phẩm được duyệt',
      message: `Sản phẩm "${productTitle || 'của bạn'}" đã được duyệt và đang hiển thị trên cửa hàng.`,
      type: 'PRODUCT',
      targetId: productId,
    });
  },

  'product.rejected': async (payload) => {
    const { sellerId, productId, productTitle, reason } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'Sản phẩm bị từ chối',
      message: `Sản phẩm "${productTitle || 'của bạn'}" đã bị từ chối.${reason ? ` Lý do: ${reason}` : ''}`,
      type: 'PRODUCT',
      targetId: productId,
    });
  },

  'karma.updated': async (payload) => {
    const { userId, karmaChange, reason } = payload;
    const direction = karmaChange >= 0 ? 'increased' : 'decreased';
    await sendNotification({
      recipientId: userId,
      title: 'Karma Updated',
      message: `Your karma has ${direction} by ${Math.abs(karmaChange)}${reason ? `. Reason: ${reason}` : ''}`,
      type: 'KARMA',
      targetId: userId,
    });
  },

  'report.created': async (payload) => {
    const { reporterId, reportedUserId, reportId } = payload;
    await sendNotification({
      recipientId: reporterId,
      title: 'Report Submitted',
      message: `Your report #${reportId} has been submitted and is under review`,
      type: 'REPORT',
      targetId: reportId,
    });
    if (reportedUserId) {
      await sendNotification({
        recipientId: reportedUserId,
        title: 'Account Under Review',
        message: 'Your account has been flagged for review',
        type: 'REPORT',
        targetId: reportId,
      });
    }
  },
};

/**
 * Start the Kafka consumer.
 * Each incoming message is parsed as JSON and dispatched to the matching handler.
 */
export async function startKafkaConsumer() {
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
            await handler(payload);
          } else {
            logger.warn(`No handler for topic: ${topic}`);
          }
        } catch (err) {
          logger.error(`Error processing Kafka message from ${topic}`, {
            error: err.message,
            partition,
            offset: message.offset,
          });

          // Save to DLQ for monitoring/retry
          try {
            const rawValue = message.value?.toString();
            await DlqEvent.create({
              topic,
              payload: rawValue ? JSON.parse(rawValue) : null,
              error: err.message,
              status: 'PENDING',
            });
            logger.info(`Event saved to DLQ: ${topic}`);
          } catch (dlqErr) {
            logger.error(`Failed to save to DLQ: ${dlqErr.message}`);
          }
        }
      },
    });

    logger.info(`Kafka consumer started: group=${GROUP_ID}, topics=${TOPICS.map((t) => t.topic).join(', ')}`);
  } catch (err) {
    logger.error('Failed to start Kafka consumer', { error: err.message });
    throw err;
  }
}
