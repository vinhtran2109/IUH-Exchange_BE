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
  { topic: 'order.updated', fromBeginning: false },
  { topic: 'order.completed', fromBeginning: false },
  { topic: 'order.cancelled', fromBeginning: false },
  { topic: 'order.payment.reported', fromBeginning: false },
  { topic: 'order.payment.confirmed', fromBeginning: false },
  { topic: 'order.dispute.opened', fromBeginning: false },
  { topic: 'order.dispute.resolved', fromBeginning: false },
  { topic: 'order.dispute.evidence_added', fromBeginning: false },
  { topic: 'order.refunded', fromBeginning: false },
  { topic: 'order.handover.proposed', fromBeginning: false },
  { topic: 'order.handover.responded', fromBeginning: false },
  { topic: 'order.handover.confirmed', fromBeginning: false },
  { topic: 'order.payment_issue.opened', fromBeginning: false },
  { topic: 'order.payment_issue.resolved', fromBeginning: false },
  { topic: 'product.reserved', fromBeginning: false },
  { topic: 'product.reserve.expired', fromBeginning: false },
  { topic: 'product.approved', fromBeginning: false },
  { topic: 'product.rejected', fromBeginning: false },
  { topic: 'offer.created', fromBeginning: false },
  { topic: 'offer.resolved', fromBeginning: false },
  { topic: 'karma.updated', fromBeginning: false },
  { topic: 'report.created', fromBeginning: false },
  { topic: 'report.resolved', fromBeginning: false },
  { topic: 'lostfound.analyzed', fromBeginning: false },
  { topic: 'lostfound.match', fromBeginning: false },
  { topic: 'user.student_verification.requested', fromBeginning: false },
  { topic: 'user.student_verification.reviewed', fromBeginning: false },
  { topic: 'lostfound.claim.created', fromBeginning: false },
  { topic: 'lostfound.claim.resolved', fromBeginning: false },
];

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || process.env.GATEWAY_SECRET || process.env.JWT_SECRET || 'dev-secret';

/**
 * Fetch user profile from user-service (internal call).
 */
async function getUserProfile(userId) {
  if (!userId) return null;
  try {
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/users/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const user = data?.data;
    if (!user) return null;

    return {
      name: user.name || user.fullName || user.email || null,
      email: user.email || null,
      studentId: user.studentId || '',
    };
  } catch (err) {
    logger.warn(`Failed to fetch user profile ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch product info from product-service (internal call).
 */
async function getProductInfo(productId) {
  if (!productId) return null;
  try {
    const res = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`, {
      headers: {
        'x-internal-service': 'notification-service',
        'x-internal-token': INTERNAL_SERVICE_TOKEN,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const product = data?.data;
    if (!product) return null;

    return {
      title: product.title || product.name || null,
      price: product.price,
      category: product.category || '',
      condition: product.condition || '',
    };
  } catch (err) {
    logger.warn(`Failed to fetch product info ${productId}: ${err.message}`);
    return null;
  }
}

async function buildOrderEmailDetails(payload, status) {
  const [buyerProfile, sellerProfile, productInfo] = await Promise.all([
    getUserProfile(payload.buyerId),
    getUserProfile(payload.sellerId),
    getProductInfo(payload.productId),
  ]);

  return {
    orderCode: payload.orderId ? `#${String(payload.orderId).substring(0, 8)}` : '',
    status,
    reason: payload.reason || '',
    price: payload.price,
    buyer: {
      name: buyerProfile?.name || payload.buyerName || 'Chưa có tên',
      email: buyerProfile?.email || '',
      studentId: buyerProfile?.studentId || '',
    },
    seller: {
      name: sellerProfile?.name || payload.sellerName || 'Chưa có tên',
      email: sellerProfile?.email || '',
      studentId: sellerProfile?.studentId || '',
    },
    product: {
      title: productInfo?.title || payload.productTitle || 'Chưa có tên sản phẩm',
      price: payload.price ?? productInfo?.price,
      category: productInfo?.category || '',
      condition: productInfo?.condition || '',
    },
  };
}

function orderProductLabel(orderDetails) {
  return orderDetails?.product?.title && orderDetails.product.title !== 'Chưa có tên sản phẩm'
    ? `"${orderDetails.product.title}"`
    : 'sản phẩm trong đơn';
}

function personLabel(person, fallback = 'Đối tác') {
  return person?.name && person.name !== 'Chưa có tên' ? person.name : fallback;
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
function buildNotificationLink(type, targetId, explicitLink) {
  if (explicitLink) return explicitLink;
  if (!targetId) return null;

  const upperType = String(type || '').toUpperCase();
  if (upperType.includes('ORDER')) return `/orders/${targetId}`;
  if (upperType.includes('PRODUCT')) return `/products/${targetId}`;
  if (upperType.includes('REPORT')) return '/my-reports';
  if (upperType.includes('KARMA')) return '/karma-history';
  return null;
}

async function sendNotification({ recipientId, title, message, type, targetId, link }) {
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
    link: buildNotificationLink(type, targetId, link),
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
    const { sellerId, orderId } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Chờ xác nhận');
    const result = await sendNotification({
      recipientId: sellerId,
      title: 'Đơn hàng mới',
      message: `${personLabel(orderDetails.buyer, 'Người mua')} vừa gửi yêu cầu mua ${orderProductLabel(orderDetails)}.`,
      type: 'ORDER',
      targetId: orderId,
    });
    // Send email (respect preference)
    if (result?.shouldSendEmail) {
      if (orderDetails.seller.email) {
        await sendOrderEmail(orderDetails.seller.email, {
          subject: 'Đơn hàng mới',
          title: 'Bạn có đơn hàng mới!',
          body: 'Một người mua vừa gửi yêu cầu mua sản phẩm của bạn. Vui lòng kiểm tra và xác nhận đơn hàng.',
          orderId,
          status: 'Chờ xác nhận',
          orderDetails,
        });
      }
    }
  },

  'order.updated': async (payload) => {
    const { buyerId, sellerId, orderId, status } = payload;
    const statusLabel = status === 'AWAITING_SELLER' ? 'Chờ người bán xác nhận' : 'Đã cập nhật';
    const orderDetails = await buildOrderEmailDetails(payload, statusLabel);
    for (const recipientId of [buyerId, sellerId].filter(Boolean)) {
      await sendNotification({
        recipientId,
        title: 'Đơn hàng đã cập nhật',
        message: `Đơn ${orderProductLabel(orderDetails)} đã chuyển sang trạng thái ${statusLabel}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.completed': async (payload) => {
    const { buyerId, sellerId, orderId } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Hoàn tất');
    const recipientProfiles = new Map([
      [buyerId, orderDetails.buyer],
      [sellerId, orderDetails.seller],
    ]);
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      const { shouldSendEmail } = await sendNotification({
        recipientId,
        title: 'Giao dịch hoàn tất',
        message: `Giao dịch ${orderProductLabel(orderDetails)} đã hoàn tất thành công.`,
        type: 'ORDER',
        targetId: orderId,
      });
      if (shouldSendEmail) {
        const recipient = recipientProfiles.get(recipientId);
        if (recipient?.email) {
          await sendOrderEmail(recipient.email, {
            subject: 'Giao dịch thành công',
            title: 'Giao dịch hoàn tất!',
            body: `Đơn hàng #${String(orderId).substring(0, 8)} đã được xác nhận hoàn tất. Cảm ơn bạn đã sử dụng ${process.env.APP_NAME || 'IUH Exchange'}!`,
            orderId,
            status: 'Hoàn tất',
            orderDetails,
          });
        }
      }
    }
  },

  'order.cancelled': async (payload) => {
    const { buyerId, sellerId, orderId, reason } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã hủy');
    const recipientProfiles = new Map([
      [buyerId, orderDetails.buyer],
      [sellerId, orderDetails.seller],
    ]);
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      const { shouldSendEmail } = await sendNotification({
        recipientId,
        title: 'Đơn hàng đã hủy',
        message: `Đơn ${orderProductLabel(orderDetails)} đã bị hủy${reason ? `: ${reason}` : ''}.`,
        type: 'ORDER',
        targetId: orderId,
      });
      if (shouldSendEmail) {
        const recipient = recipientProfiles.get(recipientId);
        if (recipient?.email) {
          await sendOrderEmail(recipient.email, {
            subject: 'Đơn hàng đã bị hủy',
            title: 'Đơn hàng bị hủy',
            body: `Đơn hàng #${String(orderId).substring(0, 8)} đã bị hủy.${reason ? ` Lý do: ${reason}` : ''}`,
            orderId,
            status: 'Đã hủy',
            orderDetails,
          });
        }
      }
    }
  },

  'order.payment.reported': async (payload) => {
    const { sellerId, orderId } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã báo chuyển khoản');
    await sendNotification({
      recipientId: sellerId,
      title: 'Người mua đã báo chuyển khoản',
      message: `${personLabel(orderDetails.buyer, 'Người mua')} đã báo chuyển khoản cho ${orderProductLabel(orderDetails)}. Vui lòng kiểm tra và xác nhận khi tiền đã vào tài khoản.`,
      type: 'ORDER',
      targetId: orderId,
    });
  },

  'order.payment.confirmed': async (payload) => {
    const { buyerId, sellerId, orderId, paymentMethod } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã thanh toán');
    const isOnlinePayment = paymentMethod === 'VNPAY_MOCK';

    const recipients = isOnlinePayment
      ? [sellerId].filter(Boolean)
      : [buyerId].filter(Boolean);

    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Thanh toán thành công',
        message: isOnlinePayment
          ? `${personLabel(orderDetails.buyer, 'Người mua')} đã thanh toán online cho ${orderProductLabel(orderDetails)}.`
          : `${personLabel(orderDetails.seller, 'Người bán')} đã xác nhận nhận tiền cho ${orderProductLabel(orderDetails)}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.dispute.opened': async (payload) => {
    const { buyerId, sellerId, orderId, reason, openedBy } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đang tranh chấp');
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Tranh chấp đơn hàng',
        message: `Đơn ${orderProductLabel(orderDetails)} vừa được mở tranh chấp${openedBy ? ' bởi một bên trong giao dịch' : ''}${reason ? `: ${reason}` : ''}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.dispute.resolved': async (payload) => {
    const { buyerId, sellerId, orderId, outcome, remedy, resolution, sanctions = {} } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã xử lý tranh chấp');
    const outcomeLabel = outcome === 'SELLER_FAULT'
      ? 'người bán có lỗi'
      : outcome === 'BUYER_FAULT'
        ? 'người mua có lỗi'
        : outcome === 'BOTH_FAULT'
          ? 'cả hai bên cùng có lỗi'
          : 'không xác định lỗi rõ ràng';

    for (const recipientId of [buyerId, sellerId].filter(Boolean)) {
      await sendNotification({
        recipientId,
        title: 'Tranh chấp đã được xử lý',
        message: `Admin đã xử lý tranh chấp cho ${orderProductLabel(orderDetails)}: ${outcomeLabel}${remedy === 'REFUND' ? ', có hoàn tiền' : ''}${remedy === 'CANCEL_ORDER' ? ', giao dịch đã bị hủy' : ''}.${resolution ? ` Ghi chú: ${resolution}` : ''}${recipientId === buyerId && sanctions.buyer && sanctions.buyer !== 'Không áp dụng' ? ` Chế tài của bạn: ${sanctions.buyer}.` : ''}${recipientId === sellerId && sanctions.seller && sanctions.seller !== 'Không áp dụng' ? ` Chế tài của bạn: ${sanctions.seller}.` : ''}`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.refunded': async (payload) => {
    const { buyerId, sellerId, orderId, amount } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã hoàn tiền');
    const recipients = [buyerId, sellerId].filter(Boolean);
    for (const recipientId of recipients) {
      await sendNotification({
        recipientId,
        title: 'Hoàn tiền đơn hàng',
        message: `Đơn ${orderProductLabel(orderDetails)} đã được hoàn tiền${amount ? ` ${Number(amount).toLocaleString('vi-VN')}đ` : ''}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.dispute.evidence_added': async (payload) => {
    const { buyerId, sellerId, orderId, submittedBy } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đang tranh chấp');
    for (const recipientId of [buyerId, sellerId].filter(Boolean).filter((id) => String(id) !== String(submittedBy))) {
      await sendNotification({
        recipientId,
        title: 'Bằng chứng tranh chấp mới',
        message: `Đơn ${orderProductLabel(orderDetails)} vừa có bằng chứng tranh chấp mới.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.handover.proposed': async (payload) => {
    const { buyerId, sellerId, orderId, proposedBy, location } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đang hẹn giao nhận');
    for (const recipientId of [buyerId, sellerId].filter(Boolean).filter((id) => String(id) !== String(proposedBy))) {
      await sendNotification({
        recipientId,
        title: 'Lịch hẹn giao nhận mới',
        message: `Đơn ${orderProductLabel(orderDetails)} có đề xuất hẹn tại ${location || 'IUH'}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.handover.responded': async (payload) => {
    const { buyerId, sellerId, orderId, respondedBy, action } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đang hẹn giao nhận');
    for (const recipientId of [buyerId, sellerId].filter(Boolean).filter((id) => String(id) !== String(respondedBy))) {
      await sendNotification({
        recipientId,
        title: action === 'ACCEPT' ? 'Lịch hẹn đã được chấp nhận' : 'Lịch hẹn đã bị từ chối',
        message: `Đề xuất giao nhận cho ${orderProductLabel(orderDetails)} đã được phản hồi.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.handover.confirmed': async (payload) => {
    const { buyerId, sellerId, orderId, confirmedBy, handoverStatus } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đang giao nhận');
    for (const recipientId of [buyerId, sellerId].filter(Boolean).filter((id) => String(id) !== String(confirmedBy))) {
      await sendNotification({
        recipientId,
        title: handoverStatus === 'HANDED_OVER' ? 'Giao nhận đã hoàn tất' : 'Đối tác đã xác nhận giao nhận',
        message: `Đơn ${orderProductLabel(orderDetails)} vừa cập nhật trạng thái giao nhận.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.payment_issue.opened': async (payload) => {
    const { buyerId, sellerId, orderId, openedBy, reason } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Có khiếu nại thanh toán');
    for (const recipientId of [buyerId, sellerId].filter(Boolean).filter((id) => String(id) !== String(openedBy))) {
      await sendNotification({
        recipientId,
        title: 'Có khiếu nại thanh toán',
        message: `Đơn ${orderProductLabel(orderDetails)} vừa có khiếu nại thanh toán${reason ? `: ${reason}` : ''}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'order.payment_issue.resolved': async (payload) => {
    const { buyerId, sellerId, orderId, action, status } = payload;
    const orderDetails = await buildOrderEmailDetails(payload, 'Đã xử lý khiếu nại thanh toán');
    const actionLabel = action === 'CONFIRM_PAID'
      ? 'đã xác nhận thanh toán'
      : action === 'REFUND'
        ? 'đã hoàn tiền'
        : status === 'REJECTED'
          ? 'đã từ chối khiếu nại'
          : 'đã xử lý khiếu nại';

    for (const recipientId of [buyerId, sellerId].filter(Boolean)) {
      await sendNotification({
        recipientId,
        title: 'Khiếu nại thanh toán đã xử lý',
        message: `Admin ${actionLabel} cho ${orderProductLabel(orderDetails)}.`,
        type: 'ORDER',
        targetId: orderId,
      });
    }
  },

  'product.reserved': async (payload) => {
    const { sellerId, productId, orderId, buyerName, productTitle } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: 'Sản phẩm đã được giữ chỗ',
      message: `${buyerName || 'Người mua'} vừa giữ chỗ "${productTitle || 'sản phẩm của bạn'}".`,
      type: 'ORDER',
      targetId: orderId || productId,
    });
  },

  'product.reserve.expired': async (payload) => {
    const { buyerId, sellerId, orderId, productId, productTitle } = payload;
    for (const recipientId of [buyerId, sellerId].filter(Boolean)) {
      await sendNotification({
        recipientId,
        title: 'Giữ chỗ đã hết hạn',
        message: `Thời gian giữ chỗ cho "${productTitle || 'sản phẩm này'}" đã hết hạn.`,
        type: 'ORDER',
        targetId: orderId || productId,
      });
    }
  },

  'offer.created': async (payload) => {
    const { sellerId, offerId, productId, type, amount } = payload;
    await sendNotification({
      recipientId: sellerId,
      title: type === 'TRADE' ? 'Đề xuất đổi đồ mới' : 'Đề xuất giá mới',
      message: type === 'TRADE' ? 'Có người muốn đổi đồ với sản phẩm của bạn.' : `Có người trả giá ${Number(amount || 0).toLocaleString('vi-VN')}đ.`,
      type: 'PRODUCT',
      targetId: productId || offerId,
    });
  },

  'offer.resolved': async (payload) => {
    const { buyerId, offerId, productId, status } = payload;
    await sendNotification({
      recipientId: buyerId,
      title: status === 'ACCEPTED' ? 'Đề xuất đã được chấp nhận' : status === 'COUNTERED' ? 'Người bán đã trả giá lại' : 'Đề xuất đã được phản hồi',
      message: status === 'ACCEPTED' ? 'Bạn có thể tạo đơn hàng từ đề xuất đã chốt.' : `Trạng thái đề xuất: ${status}.`,
      type: 'PRODUCT',
      targetId: productId || offerId,
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
    const direction = karmaChange >= 0 ? 'tăng' : 'giảm';
    await sendNotification({
      recipientId: userId,
      title: 'Karma đã cập nhật',
      message: `Điểm karma của bạn ${direction} ${Math.abs(karmaChange)} điểm${reason ? `. Lý do: ${reason}` : ''}.`,
      type: 'KARMA',
      targetId: null,
    });
  },

  'report.created': async (payload) => {
    const { reporterId, reportedUserId, reportId, targetTitle } = payload;
    await sendNotification({
      recipientId: reporterId,
      title: 'Đã gửi tố cáo',
      message: `Tố cáo${targetTitle ? ` về "${targetTitle}"` : ''} đã được gửi và đang chờ xem xét.`,
      type: 'REPORT',
      targetId: reportId,
    });
    if (reportedUserId) {
      await sendNotification({
        recipientId: reportedUserId,
        title: 'Tài khoản đang được xem xét',
        message: 'Tài khoản của bạn có nội dung bị tố cáo và đang được quản trị viên xem xét.',
        type: 'REPORT',
        targetId: reportId,
      });
    }
  },

  'report.resolved': async (payload) => {
    const { reporterId, reportId, status, targetType, adminNote } = payload;
    const statusText = status === 'DISMISSED'
      ? 'đã được xem xét và bỏ qua'
      : status === 'REVIEWED'
        ? 'đã được ghi nhận'
        : 'đã được xử lý';
    const targetText = targetType === 'PRODUCT'
      ? 'sản phẩm'
      : targetType === 'LOST_FOUND'
        ? 'tin mất/nhặt đồ'
        : 'người dùng';
    const noteText = adminNote ? ` Ghi chú: ${adminNote}` : '';

    await sendNotification({
      recipientId: reporterId,
      title: 'Tố cáo đã được cập nhật',
      message: `Tố cáo của bạn về ${targetText} ${statusText}.${noteText}`,
      type: 'REPORT',
      targetId: reportId,
      link: '/my-reports',
    });
  },

  'lostfound.analyzed': async (payload) => {
    const { itemId, title, studentId, type } = payload;

    // If MSSV found and item is FOUND, try to notify the owner of that student ID
    if (studentId && type === 'FOUND') {
      try {
        const userRes = await fetch(`${USER_SERVICE_URL}/api/v1/users/by-student/${studentId}`);
        const userData = await userRes.json();
        if (userData?.data?.id) {
          await sendNotification({
            recipientId: userData.data.id,
            title: 'Có thể tìm thấy đồ của bạn!',
            message: `Một vật phẩm phù hợp với MSSV ${studentId} của bạn vừa được đăng tìm: "${title}"`,
            type: 'SYSTEM',
            targetId: itemId,
            link: `/lost-found/${itemId}`,
          });
        }
      } catch {
        // User not found or service unavailable — non-fatal
        logger.debug(`Could not resolve studentId ${studentId} to user`);
      }
    }
  },

  'lostfound.match': async (payload) => {
    const { userId, itemId, title, type, matches } = payload;

    if (!matches?.length) return;

    const reliableMatches = matches
      .filter((match) => Number(match.score || 0) >= 0.6)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    if (!reliableMatches.length) return;

    const matchCount = reliableMatches.length;
    const bestScore = Math.round((reliableMatches[0]?.score || 0) * 100);

    await sendNotification({
      recipientId: userId,
      title: 'Tìm thấy vật phẩm phù hợp!',
      message: `Có ${matchCount} vật phẩm có thể khớp với "${title}" (độ phù hợp cao nhất: ${bestScore}%). Kiểm tra ngay!`,
      type: 'SYSTEM',
      targetId: itemId,
      link: `/lost-found/${itemId}`,
    });

    const oppositeType = type === 'LOST' ? 'FOUND' : 'LOST';
    for (const match of reliableMatches.slice(0, 2)) {
      if (match.ownerId && match.ownerId !== userId) {
        const matchScore = Math.round((match.score || 0) * 100);
        await sendNotification({
          recipientId: match.ownerId,
          title: 'Có vật phẩm khớp với bài đăng của bạn!',
          message: `"${title}" có thể là vật phẩm ${oppositeType === 'LOST' ? 'bị mất' : 'nhặt được'} liên quan đến bài "${match.title}" của bạn (${matchScore}% phù hợp).`,
          type: 'SYSTEM',
          targetId: match.itemId,
          link: `/lost-found/${match.itemId}`,
        });
      }
    }
  },

  'user.student_verification.requested': async (payload) => {
    await sendNotification({
      recipientId: payload.userId,
      title: 'Đã gửi xác minh MSSV',
      message: 'Yêu cầu xác minh MSSV của bạn đang chờ admin duyệt.',
      type: 'SYSTEM',
      targetId: payload.userId,
    });
  },

  'user.student_verification.reviewed': async (payload) => {
    await sendNotification({
      recipientId: payload.userId,
      title: payload.status === 'VERIFIED' ? 'MSSV đã được xác minh' : 'Xác minh MSSV bị từ chối',
      message: payload.adminNote || (payload.status === 'VERIFIED' ? 'Tài khoản của bạn đã được xác minh sinh viên.' : 'Vui lòng kiểm tra lại thông tin MSSV.'),
      type: 'SYSTEM',
      targetId: payload.userId,
    });
  },

  'lostfound.claim.created': async (payload) => {
    await sendNotification({
      recipientId: payload.ownerId,
      title: 'Có yêu cầu nhận đồ thất lạc',
      message: `Bài "${payload.title || 'đồ thất lạc'}" vừa có claim mới cần xác minh.`,
      type: 'SYSTEM',
      targetId: payload.itemId,
      link: `/lost-found/${payload.itemId}`,
    });
  },

  'lostfound.claim.resolved': async (payload) => {
    await sendNotification({
      recipientId: payload.claimantId,
      title: payload.status === 'APPROVED' ? 'Claim đã được duyệt' : 'Claim bị từ chối',
      message: `Yêu cầu nhận "${payload.title || 'đồ thất lạc'}" đã được phản hồi.`,
      type: 'SYSTEM',
      targetId: payload.itemId,
      link: `/lost-found/${payload.itemId}`,
    });
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
