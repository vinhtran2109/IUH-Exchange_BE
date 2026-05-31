import { Order } from '../models/Order.js';
import {
  getRedis,
  logger,
  ResourceNotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@iuh-exchange/common';
import {
  publishOrderCreated,
  publishOrderCancelled,
  publishOrderCompleted,
  publishOrderDisputeOpened,
  publishOrderEvent,
} from './saga.service.js';
import crypto from 'crypto';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

/**
 * Valid status transitions for an order.
 * Key = current status, Value = set of allowed next statuses.
 */
const VALID_TRANSITIONS = {
  PENDING: new Set(['AWAITING_SELLER', 'CANCELLED']),
  AWAITING_SELLER: new Set(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
};

function actorRoleFor(order, userId) {
  if (String(order.buyerId) === String(userId)) return 'BUYER';
  if (String(order.sellerId) === String(userId)) return 'SELLER';
  return 'SYSTEM';
}

function buildGatewayHeaders(userId) {
  const role = 'STUDENT';
  const email = '';
  const secret = process.env.GATEWAY_SECRET || process.env.JWT_SECRET || 'dev-secret';
  const signature = crypto.createHmac('sha256', secret).update(`${userId}:${role}:${email}`).digest('hex');
  return {
    'x-user-id': String(userId),
    'x-user-role': role,
    'x-user-email': email,
    'x-gateway-signature': signature,
  };
}

function buildInternalHeaders(userId) {
  const token = process.env.INTERNAL_SERVICE_TOKEN || process.env.GATEWAY_SECRET || process.env.JWT_SECRET || 'dev-secret';
  return {
    ...buildGatewayHeaders(userId),
    'x-internal-service': 'order-service',
    'x-internal-token': token,
  };
}

function productSnapshot(product) {
  if (!product) return null;
  return {
    id: product.id || product._id,
    _id: product._id || product.id,
    title: product.title || '',
    description: product.description || '',
    price: product.price,
    imageUrls: product.imageUrls || [],
    category: product.category,
    condition: product.condition,
    status: product.status,
    sellerId: product.sellerId,
  };
}

function userSnapshot(user) {
  if (!user) return null;
  return {
    id: user.id || user._id,
    _id: user._id || user.id,
    name: user.name || '',
    studentId: user.studentId || '',
    avatarUrl: user.avatarUrl || '',
    karmaPoint: user.karmaPoint,
    role: user.role,
  };
}

async function fetchProductSnapshot(productId, actorId) {
  if (!productId) return null;
  try {
    const response = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`, {
      headers: buildInternalHeaders(actorId || 'order-service'),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) return null;
    return productSnapshot(body.data);
  } catch (err) {
    logger.warn(`[OrderDetail] Product snapshot unavailable: productId=${productId}, error=${err.message}`);
    return null;
  }
}

async function fetchUserSnapshot(userId) {
  if (!userId) return null;
  try {
    const response = await fetch(`${USER_SERVICE_URL}/api/v1/users/${userId}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) return null;
    return userSnapshot(body.data);
  } catch (err) {
    logger.warn(`[OrderDetail] User snapshot unavailable: userId=${userId}, error=${err.message}`);
    return null;
  }
}

async function enrichOrderDetail(order) {
  const [product, buyer, seller] = await Promise.all([
    fetchProductSnapshot(order.productId, order.sellerId || order.buyerId),
    fetchUserSnapshot(order.buyerId),
    fetchUserSnapshot(order.sellerId),
  ]);

  return {
    ...order,
    product,
    buyer,
    seller,
    productTitle: product?.title || order.productTitle || '',
  };
}

async function getAcceptedOfferCheckout(offerId, buyerId) {
  const response = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/products/offers/${offerId}/checkout`, {
    headers: buildGatewayHeaders(buyerId),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new BadRequestException(body?.message || body?.error || 'Cannot create order from this offer');
  }
  return body.data;
}

async function getProductCheckoutSnapshot(productId, buyerId) {
  const response = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`, {
    headers: buildGatewayHeaders(buyerId),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) {
    throw new BadRequestException(body?.message || body?.error || 'Không thể lấy thông tin sản phẩm để tạo đơn');
  }

  const product = body.data;
  if (!product) {
    throw new BadRequestException('Sản phẩm không tồn tại');
  }
  if (product.status !== 'AVAILABLE') {
    throw new BadRequestException('Sản phẩm hiện không còn khả dụng để đặt mua');
  }

  return {
    productId: product.id || product._id || productId,
    sellerId: product.sellerId,
    price: Number(product.price || 0),
    listingType: product.listingType || 'SELL',
    productTitle: product.title || '',
  };
}

function appendStatusHistory(order, nextStatus, {
  changedBy = 'system',
  actorRole = 'SYSTEM',
  reason = '',
  metadata = {},
} = {}) {
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    from: order.status || null,
    to: nextStatus,
    changedBy,
    actorRole,
    reason,
    metadata,
  });
  order.status = nextStatus;
  if (nextStatus === 'COMPLETED') {
    order.completedAt = new Date();
  }
  if (nextStatus === 'CANCELLED') {
    order.cancelledAt = new Date();
    order.cancelledBy = changedBy;
    order.cancellationReason = reason;
    order.cancellationCategory = metadata?.category || order.cancellationCategory || 'OTHER';
  }
}

function buildReceiptNumber(order) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = order._id.toString().slice(-6).toUpperCase();
  return `IUH-${datePart}-${suffix}`;
}

function generateHandoverCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function disputeKarmaAdjustments(order, { status, outcome, adminId, resolution }) {
  if (status === 'REJECTED') {
    return [{ userId: order.disputeOpenedBy, amount: -5, reason: 'Tranh chấp bị từ chối do không đủ căn cứ', source: 'DISPUTE_REJECTED', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome: 'REJECTED', resolution } }];
  }
  if (outcome === 'SELLER_FAULT') {
    return [
      { userId: order.sellerId, amount: -15, reason: 'Admin xác định người bán có lỗi trong tranh chấp', source: 'DISPUTE_SELLER_FAULT', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome, resolution } },
      { userId: order.buyerId, amount: 3, reason: 'Tranh chấp được xử lý có lợi cho người mua', source: 'DISPUTE_BUYER_PROTECTED', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome, resolution } },
    ];
  }
  if (outcome === 'BUYER_FAULT') {
    return [{ userId: order.buyerId, amount: -10, reason: 'Admin xác định người mua có lỗi trong tranh chấp', source: 'DISPUTE_BUYER_FAULT', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome, resolution } }];
  }
  if (outcome === 'BOTH_FAULT') {
    return [
      { userId: order.buyerId, amount: -5, reason: 'Admin xác định cả hai bên cùng có lỗi trong tranh chấp', source: 'DISPUTE_BOTH_FAULT_BUYER', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome, resolution } },
      { userId: order.sellerId, amount: -5, reason: 'Admin xác định cả hai bên cùng có lỗi trong tranh chấp', source: 'DISPUTE_BOTH_FAULT_SELLER', relatedId: order._id.toString(), performedBy: adminId, metadata: { outcome, resolution } },
    ];
  }
  return [];
}

/**
 * Order Service - Business logic for order management.
 * Implements Saga Choreography Pattern via Kafka.
 */
export class OrderService {
  /**
   * Create a new order with idempotency protection.
   *
   * Flow:
   * 1. Check Redis for idempotency key → return cached result if exists
   * 2. Validate buyer != seller
   * 3. Save order with status PENDING
   * 4. Publish OrderCreatedEvent to Kafka (triggers product reservation)
   * 5. Cache result in Redis for 24h
   *
   * @param {string} buyerId - Authenticated buyer's user ID
   * @param {object} request - { productId, sellerId, price, buyerNote, idempotencyKey }
   * @returns {Promise<object>} Created order
   */
  async createOrder(buyerId, request) {
    const redis = getRedis();
    const redisKey = `idempotency:order:${request.idempotencyKey}`;

    // Step 1: Check idempotency in Redis
    const existingOrderId = await redis.get(redisKey);
    if (existingOrderId) {
      logger.warn(`Duplicate order request detected: idempotencyKey=${request.idempotencyKey}`);
      const existingOrder = await Order.findById(existingOrderId);
      if (existingOrder) {
        return existingOrder.toObject();
      }
      // Fallback: look up by idempotency key in DB
      const byKey = await Order.findOne({ idempotencyKey: request.idempotencyKey });
      if (byKey) {
        return byKey.toObject();
      }
      throw new ConflictException('Order đang được xử lý, vui lòng chờ...');
    }

    // Reserve the idempotency key immediately (NX = only set if not exists)
    const acquired = await redis.set(
      redisKey,
      'PROCESSING',
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
      'NX'
    );
    if (!acquired) {
      // Race condition: another request grabbed it
      const byKey = await Order.findOne({ idempotencyKey: request.idempotencyKey });
      if (byKey) {
        return byKey.toObject();
      }
      throw new ConflictException('Order đang được xử lý, vui lòng chờ...');
    }

    try {
      if (request.offerId) {
        const checkout = await getAcceptedOfferCheckout(request.offerId, buyerId);
        request.productId = checkout.productId;
        request.sellerId = checkout.sellerId;
        request.price = checkout.price;
        request.tradeMetadata = {
          listingType: checkout.listingType,
          tradeItemTitle: checkout.tradeItemTitle,
          tradeItemDescription: checkout.tradeItemDescription,
        };
      } else {
        const checkout = await getProductCheckoutSnapshot(request.productId, buyerId);
        request.productId = checkout.productId;
        request.sellerId = checkout.sellerId;
        request.price = checkout.price;
        request.tradeMetadata = {
          listingType: checkout.listingType,
        };
      }

      // Step 2: Validate buyer cannot buy from themselves
      if (buyerId === request.sellerId) {
        await redis.del(redisKey);
        throw new BadRequestException('Bạn không thể mua sản phẩm của chính mình!');
      }

      // Step 3: Save order to MongoDB with status PENDING
      let order;
      try {
        order = await Order.create({
          buyerId,
          sellerId: request.sellerId,
          productId: request.productId,
          offerId: request.offerId || null,
          price: request.price,
          listingType: request.tradeMetadata?.listingType || 'SELL',
          tradeItemTitle: request.tradeMetadata?.tradeItemTitle || '',
          tradeItemDescription: request.tradeMetadata?.tradeItemDescription || '',
          buyerNote: request.buyerNote || '',
          handoverLocation: request.handoverLocation || '',
          handoverTime: request.handoverTime || null,
          handoverStatus: request.handoverLocation && request.handoverTime ? 'PROPOSED' : 'NOT_SCHEDULED',
          paymentMethod: ['BANK_TRANSFER', 'CASH'].includes(request.paymentMethod) ? request.paymentMethod : 'NONE',
          meetingProposals: request.handoverLocation && request.handoverTime ? [{
            location: request.handoverLocation,
            time: request.handoverTime,
            note: request.buyerNote || '',
            proposedBy: buyerId,
          }] : [],
          idempotencyKey: request.idempotencyKey,
          status: 'PENDING',
          statusHistory: [{
            from: null,
            to: 'PENDING',
            changedBy: buyerId,
            actorRole: 'BUYER',
            reason: 'Order created',
          }],
        });
      } catch (dbErr) {
        // Bug #3 fix: Handle duplicate key error from race condition (TOCTOU)
        if (dbErr.code === 11000) {
          const existing = await Order.findOne({ idempotencyKey: request.idempotencyKey });
          if (existing) {
            await redis.set(redisKey, existing._id.toString(), 'EX', IDEMPOTENCY_TTL_SECONDS);
            return existing.toObject();
          }
        }
        throw dbErr;
      }

      logger.info(`[SAGA Step 1] Order created: orderId=${order._id}, productId=${order.productId}`);

      // Step 4: Publish OrderCreatedEvent to Kafka
      await publishOrderCreated({
        orderId: order._id.toString(),
        productId: order.productId,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        price: order.price,
        offerId: order.offerId,
      });

      // Step 5: Update Redis with actual orderId for future lookups
      await redis.set(redisKey, order._id.toString(), 'EX', IDEMPOTENCY_TTL_SECONDS);

      return order.toObject();
    } catch (err) {
      // Only clean up idempotency key for non-duplicate errors
      if (!(err instanceof ConflictException)) {
        await redis.del(redisKey);
      }
      throw err;
    }
  }

  /**
   * Mark order as AWAITING_SELLER after product has been reserved.
   * Called by saga consumer when ProductReservedEvent is received.
   *
   * @param {string} orderId
   */
  async markAwaitingSellerConfirmation(orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[SAGA] Order not found for product.reserved: orderId=${orderId}`);
      return;
    }

    // Skip if already in terminal state
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      logger.info(`[SAGA] Skipping status update for terminal order: orderId=${orderId}, status=${order.status}`);
      return;
    }

    appendStatusHistory(order, 'AWAITING_SELLER', {
      actorRole: 'SYSTEM',
      reason: 'Product reserved successfully',
    });
    await order.save();
    logger.info(`[SAGA Step 2] Order awaiting seller confirmation: orderId=${orderId}`);

    await publishOrderEvent('order.updated', {
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      reason: 'Product reserved successfully',
    });
  }

  /**
   * Cancel an order (compensating transaction).
   * Called when ProductReserveFailedEvent is received, or by seller rejection.
   *
   * @param {string} orderId
   * @param {string} reason
   */
  async cancelOrder(orderId, reason) {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[SAGA] Order not found for cancellation: orderId=${orderId}`);
      return;
    }

    if (order.status === 'COMPLETED') {
      logger.warn(`[SAGA] Cannot cancel completed order: orderId=${orderId}`);
      return;
    }

    appendStatusHistory(order, 'CANCELLED', {
      actorRole: 'SYSTEM',
      reason,
    });
    await order.save();
    logger.info(`[SAGA Rollback] Order cancelled: orderId=${orderId}, reason=${reason}`);

    // Publish cancellation event so other services can compensate
    await publishOrderCancelled({
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      reason,
    });
  }

  /**
   * Seller confirms an order → mark as COMPLETED and publish event for karma adjustment.
   *
   * @param {string} orderId
   * @param {string} sellerId - Authenticated seller's user ID
   * @returns {object} Updated order
   */
  async confirmOrder(orderId, sellerId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('Bạn không có quyền xác nhận đơn này');
    }

    // Bug #21 fix: Only allow confirm when order is in AWAITING_SELLER status
    if (order.status !== 'AWAITING_SELLER') {
      throw new BadRequestException(`Đơn hàng không ở trạng thái chờ xác nhận (hiện tại: ${order.status})`);
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã bị hủy');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã được xác nhận');
    }

    if (order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Nguoi ban can xac nhan da nhan tien truoc khi hoan tat don chuyen khoan');
    }

    if (order.paymentMethod === 'CASH' && order.paymentStatus !== 'PAID') {
      const paidAt = new Date();
      order.paymentStatus = 'PAID';
      order.paymentProviderStatus = 'CASH_CONFIRMED';
      order.paymentWebhookVerified = false;
      order.reconciliationStatus = 'MATCHED';
      order.paidAt = paidAt;
      order.paymentTransactionId = order.paymentTransactionId || `CASH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      order.transactions = order.transactions || [];
      order.transactions.push({
        type: 'CASH_CONFIRMED',
        transactionId: order.paymentTransactionId,
        amount: order.price,
        method: 'CASH',
        status: 'SUCCESS',
        note: 'Seller confirmed cash payment during handover',
      });
    }

    this._assertTransition(order.status, 'COMPLETED');

    appendStatusHistory(order, 'COMPLETED', {
      changedBy: sellerId,
      actorRole: 'SELLER',
      reason: 'Seller confirmed order',
    });
    await order.save();
    logger.info(`[SELLER CONFIRM] Order completed: orderId=${orderId}, sellerId=${sellerId}`);

    // Publish OrderCompletedEvent for Karma Service to adjust points
    await publishOrderCompleted({
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      productId: order.productId,
    });

    return order.toObject();
  }

  /**
   * Seller rejects an order → cancel it.
   *
   * @param {string} orderId
   * @param {string} sellerId - Authenticated seller's user ID
   * @param {string} reason
   * @returns {object} Updated order
   */
  async rejectOrder(orderId, sellerId, reason, { category = 'SELLER_REJECTED' } = {}) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('Bạn không có quyền từ chối đơn này');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã được xác nhận, không thể từ chối');
    }

    this._assertTransition(order.status, 'CANCELLED');

    appendStatusHistory(order, 'CANCELLED', {
      changedBy: sellerId,
      actorRole: 'SELLER',
      reason,
      metadata: { category },
    });
    await order.save();
    logger.info(`[SELLER REJECT] Order cancelled: orderId=${orderId}, sellerId=${sellerId}, reason=${reason}`);

    await publishOrderCancelled({
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      reason,
    });

    return order.toObject();
  }

  /**
   * Get orders with pagination and optional status filter.
   *
   * @param {string} userId - Current user ID
   * @param {object} options - { page, size, status, role }
   * @returns {{ content: object[], page: number, size: number, totalElements: number, totalPages: number, last: boolean }}
   */
  async getOrders(userId, { page = 1, size = 20, status, role = 'buyer', productId } = {}) {
    const filter = {};

    // Filter by role: buyer sees orders they placed, seller sees orders for their products
    if (role === 'seller') {
      filter.sellerId = userId;
    } else {
      filter.buyerId = userId;
    }

    if (status) {
      filter.status = status;
    }

    if (productId) {
      filter.productId = productId;
    }

    const skip = (page - 1) * size;

    const [orders, totalElements] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / size);

    return {
      content: orders,
      page,
      size,
      totalElements,
      totalPages,
      last: page >= totalPages,
    };
  }

  /**
   * Get all orders where the user is buyer OR seller (combined view).
   *
   * @param {string} userId
   * @returns {object[]} Orders sorted by creation date descending
   */
  async getMyOrders(userId) {
    const orders = await Order.find({
      $or: [{ buyerId: userId }, { sellerId: userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return orders;
  }

  /**
   * Buyer cancels their own order.
   * Allowed when order is PENDING or AWAITING_SELLER.
   *
   * @param {string} orderId
   * @param {string} buyerId - Authenticated buyer's user ID
   * @param {string} [reason]
   * @returns {object} Updated order
   */
  async cancelByBuyer(orderId, buyerId, reason, { category = 'BUYER_CANCELLED' } = {}) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn này');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã hoàn tất, không thể hủy');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã bị hủy trước đó');
    }

    this._assertTransition(order.status, 'CANCELLED');

    appendStatusHistory(order, 'CANCELLED', {
      changedBy: buyerId,
      actorRole: 'BUYER',
      reason: reason || 'Người mua hủy đơn hàng',
      metadata: { category },
    });
    await order.save();
    logger.info(`[BUYER CANCEL] Order cancelled: orderId=${orderId}, buyerId=${buyerId}, reason=${reason || 'N/A'}`);

    await publishOrderCancelled({
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      reason: reason || 'Người mua hủy đơn hàng',
    });

    return order.toObject();
  }

  async reportNoShow(orderId, userId, { reason = '', evidenceUrl = '' } = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    const role = actorRoleFor(order, userId);
    if (role === 'SYSTEM') throw new ForbiddenException('Bạn không có quyền báo không đến cho đơn này');
    if (!['PENDING', 'AWAITING_SELLER'].includes(order.status)) {
      throw new BadRequestException('Chỉ có thể báo không đến khi đơn đang xử lý');
    }

    const alreadyReported = (order.noShowReports || []).some((item) => String(item.reportedBy) === String(userId));
    if (alreadyReported) throw new BadRequestException('Bạn đã báo không đến cho đơn này');

    const noShowReason = reason || (role === 'BUYER' ? 'Người bán không đến điểm hẹn' : 'Người mua không đến điểm hẹn');
    order.noShowReports = order.noShowReports || [];
    order.noShowReports.push({ reportedBy: userId, actorRole: role, reason: noShowReason, evidenceUrl });

    appendStatusHistory(order, 'CANCELLED', {
      changedBy: userId,
      actorRole: role,
      reason: noShowReason,
      metadata: { category: 'NO_SHOW', evidenceUrl },
    });
    await order.save();

    await publishOrderCancelled({
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      reason: noShowReason,
    });

    await publishOrderEvent('order.no_show.reported', {
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      reportedBy: userId,
      actorRole: role,
    });

    return order.toObject();
  }

  /**
   * Get a single order by ID.
   *
   * @param {string} orderId
   * @returns {object} Order
   */
  async getOrderById(orderId, userId, role = 'STUDENT') {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }
    const canView =
      role === 'ADMIN' ||
      String(order.buyerId) === String(userId) ||
      String(order.sellerId) === String(userId);
    if (!canView) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }
    return enrichOrderDetail(order);
  }

  async getReviewEligibility(orderId, userId) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    const eligible =
      String(order.buyerId) === String(userId) &&
      order.status === 'COMPLETED' &&
      order.disputeStatus !== 'OPEN' &&
      order.paymentIssueStatus !== 'OPEN' &&
      order.paymentStatus !== 'REFUNDED' &&
      order.disputeOutcome !== 'BUYER_FAULT';

    return {
      eligible,
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      productId: order.productId,
      status: order.status,
      disputeStatus: order.disputeStatus || 'NONE',
    };
  }

  async openDispute(orderId, userId, reason) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);

    if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
      throw new ForbiddenException('Bạn không có quyền mở tranh chấp cho đơn hàng này');
    }

    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Chỉ có thể mở tranh chấp cho đơn đã hoàn tất hoặc đã thanh toán');
    }

    if (order.disputeStatus === 'OPEN') {
      throw new BadRequestException('Đơn hàng đã có tranh chấp đang xử lý');
    }

    order.disputeStatus = 'OPEN';
    order.disputeReason = reason;
    order.disputeOpenedBy = userId;
    order.disputeOpenedAt = new Date();
    order.disputeTimeline = order.disputeTimeline || [];
    order.disputeTimeline.push({
      action: 'OPENED',
      actorId: userId,
      actorRole: actorRoleFor(order, userId),
      note: reason,
    });
    await order.save();

    await publishOrderDisputeOpened({
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      openedBy: userId,
      reason,
    });

    return order.toObject();
  }

  async addDisputeEvidence(orderId, userId, { type = 'OTHER', url, note = '' }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
      throw new ForbiddenException('Bạn không có quyền bổ sung bằng chứng cho đơn hàng này');
    }
    if (order.disputeStatus !== 'OPEN') {
      throw new BadRequestException('Chỉ có thể bổ sung bằng chứng khi tranh chấp đang mở');
    }
    if (!url) throw new BadRequestException('Evidence url is required');

    order.disputeEvidence = order.disputeEvidence || [];
    order.disputeEvidence.push({ submittedBy: userId, type, url, note });
    order.disputeTimeline = order.disputeTimeline || [];
    order.disputeTimeline.push({
      action: 'EVIDENCE_ADDED',
      actorId: userId,
      actorRole: actorRoleFor(order, userId),
      note,
    });
    await order.save();
    await publishOrderEvent('order.dispute.evidence_added', {
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      submittedBy: userId,
      type,
    });
    return order.toObject();
  }

  async proposeHandover(orderId, userId, { location, time, note = '' }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
      throw new ForbiddenException('Bạn không có quyền đề xuất lịch hẹn cho đơn này');
    }
    if (!['PENDING', 'AWAITING_SELLER'].includes(order.status)) {
      throw new BadRequestException('Chỉ có thể hẹn giao khi đơn đang xử lý');
    }
    if (!location || !time) throw new BadRequestException('location and time are required');

    for (const proposal of order.meetingProposals || []) {
      if (proposal.status === 'PENDING') {
        proposal.status = 'COUNTERED';
        proposal.respondedBy = userId;
        proposal.respondedAt = new Date();
      }
    }

    order.meetingProposals = order.meetingProposals || [];
    order.meetingProposals.push({ location, time, note, proposedBy: userId });
    order.handoverLocation = location;
    order.handoverTime = time;
    order.handoverStatus = 'PROPOSED';
    await order.save();
    await publishOrderEvent('order.handover.proposed', {
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      proposedBy: userId,
      location,
      time,
    });
    return order.toObject();
  }

  async respondHandover(orderId, userId, { proposalId, action }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
      throw new ForbiddenException('Bạn không có quyền phản hồi lịch hẹn cho đơn này');
    }

    const proposal = (order.meetingProposals || []).id?.(proposalId)
      || (order.meetingProposals || []).find((item) => String(item._id) === String(proposalId));
    if (!proposal) throw new ResourceNotFoundException('MeetingProposal', proposalId);
    if (String(proposal.proposedBy) === String(userId)) {
      throw new BadRequestException('Người đề xuất không thể tự chấp nhận lịch hẹn');
    }
    if (proposal.status !== 'PENDING') throw new BadRequestException(`Meeting proposal is already ${proposal.status.toLowerCase()}`);

    proposal.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    proposal.respondedBy = userId;
    proposal.respondedAt = new Date();
    order.handoverStatus = action === 'ACCEPT' ? 'SCHEDULED' : 'NOT_SCHEDULED';
    if (action === 'ACCEPT') {
      order.handoverLocation = proposal.location;
      order.handoverTime = proposal.time;
      order.handoverCode = generateHandoverCode();
      order.handoverCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await order.save();
    await publishOrderEvent('order.handover.responded', {
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      respondedBy: userId,
      action,
      handoverStatus: order.handoverStatus,
    });
    return order.toObject();
  }

  async confirmHandover(orderId, userId, { code = '', evidenceUrl = '', note = '' } = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    const role = actorRoleFor(order, userId);
    if (role === 'SYSTEM') throw new ForbiddenException('Bạn không có quyền xác nhận giao nhận cho đơn này');
    if (!['AWAITING_SELLER', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException('Chỉ có thể xác nhận giao nhận khi đơn đã được giữ chỗ hoặc hoàn tất');
    }
    if (order.handoverCode) {
      if (!code || String(code).trim() !== String(order.handoverCode)) {
        throw new BadRequestException('Mã bàn giao không đúng');
      }
      if (order.handoverCodeExpiresAt && order.handoverCodeExpiresAt.getTime() < Date.now()) {
        throw new BadRequestException('Mã bàn giao đã hết hạn');
      }
    }

    if (role === 'BUYER') {
      order.buyerHandoverConfirmedAt = new Date();
    } else {
      order.sellerHandoverConfirmedAt = new Date();
    }
    order.handoverProofs = order.handoverProofs || [];
    order.handoverProofs.push({ confirmedBy: userId, actorRole: role, codeUsed: code, evidenceUrl, note });

    if (order.buyerHandoverConfirmedAt && order.sellerHandoverConfirmedAt) {
      order.handoverStatus = 'HANDED_OVER';
      order.handoverCode = null;
      order.handoverCodeExpiresAt = null;
    } else {
      order.handoverStatus = role === 'BUYER' ? 'BUYER_CONFIRMED' : 'SELLER_CONFIRMED';
    }
    await order.save();
    await publishOrderEvent('order.handover.confirmed', {
      orderId: order._id.toString(),
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      confirmedBy: userId,
      handoverStatus: order.handoverStatus,
    });
    return order.toObject();
  }

  async resolveDispute(orderId, adminId, { status, resolution, outcome = 'NO_FAULT', remedy = 'NONE' }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (order.disputeStatus !== 'OPEN') {
      throw new BadRequestException('Đơn hàng không có tranh chấp đang mở');
    }

    order.disputeStatus = status === 'REJECTED' ? 'REJECTED' : 'RESOLVED';
    order.disputeOutcome = status === 'REJECTED' ? 'REJECTED' : outcome;
    order.disputeRemedy = remedy;
    order.disputeResolution = resolution || '';
    order.disputeResolvedBy = adminId;
    order.disputeResolvedAt = new Date();
    if (remedy === 'REFUND' && order.paymentStatus === 'PAID') {
      order.paymentStatus = 'REFUNDED';
      order.paymentProviderStatus = 'DISPUTE_REFUNDED';
      order.reconciliationStatus = 'MATCHED';
      order.refundedAt = new Date();
      order.transactions = order.transactions || [];
      order.transactions.push({
        type: 'REFUND_CREATED',
        transactionId: order.paymentTransactionId,
        amount: order.price,
        method: order.paymentMethod || 'DISPUTE',
        status: 'REFUNDED',
        note: resolution || 'Admin hoàn tiền sau tranh chấp',
      });
    }
    order.disputeTimeline = order.disputeTimeline || [];
    order.disputeTimeline.push({
      action: order.disputeStatus,
      actorId: adminId,
      actorRole: 'ADMIN',
      note: resolution || '',
      metadata: { outcome: order.disputeOutcome, remedy },
    });
    await order.save();

    await publishOrderEvent('order.dispute.resolved', {
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.disputeStatus,
      outcome: order.disputeOutcome,
      remedy,
      resolution,
    });

    for (const adjustment of disputeKarmaAdjustments(order, { status: order.disputeStatus, outcome: order.disputeOutcome, adminId, resolution })) {
      await publishOrderEvent('karma.adjustment.requested', adjustment);
    }

    return order.toObject();
  }

  async openPaymentIssue(orderId, userId, reason) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    const role = actorRoleFor(order, userId);
    if (role === 'SYSTEM') throw new ForbiddenException('Bạn không có quyền mở khiếu nại thanh toán cho đơn này');
    if (order.paymentIssueStatus === 'OPEN') {
      throw new BadRequestException('Đơn hàng đã có khiếu nại thanh toán đang xử lý');
    }
    if (order.paymentStatus === 'REFUNDED') {
      throw new BadRequestException('Đơn hàng đã hoàn tiền');
    }
    if (order.paymentMethod !== 'BANK_TRANSFER' && order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Chỉ có thể khiếu nại thanh toán cho đơn chuyển khoản hoặc đã thanh toán');
    }

    order.paymentIssueStatus = 'OPEN';
    order.paymentIssueReason = reason;
    order.paymentIssueOpenedBy = userId;
    order.paymentIssueOpenedAt = new Date();
    order.paymentIssueTimeline = order.paymentIssueTimeline || [];
    order.paymentIssueTimeline.push({ action: 'OPENED', actorId: userId, actorRole: role, note: reason });
    await order.save();

    await publishOrderEvent('order.payment_issue.opened', {
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      price: order.price,
      openedBy: userId,
      reason,
    });

    return order.toObject();
  }

  async resolvePaymentIssue(orderId, adminId, { action, resolution = '' }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (order.paymentIssueStatus !== 'OPEN') {
      throw new BadRequestException('Đơn hàng không có khiếu nại thanh toán đang mở');
    }

    if (action === 'CONFIRM_PAID') {
      order.paymentStatus = 'PAID';
      order.paymentProviderStatus = 'ADMIN_CONFIRMED_PAID';
      order.reconciliationStatus = 'MATCHED';
      order.paidAt = order.paidAt || new Date();
      order.transactions = order.transactions || [];
      order.transactions.push({
        type: 'TRANSFER_CONFIRMED',
        transactionId: order.paymentTransactionId || `ADMIN_${Date.now()}`,
        amount: order.price,
        method: order.paymentMethod || 'BANK_TRANSFER',
        status: 'SUCCESS',
        note: resolution || 'Admin xác nhận thanh toán',
      });
    } else if (action === 'REFUND') {
      order.paymentStatus = 'REFUNDED';
      order.paymentProviderStatus = 'ADMIN_REFUNDED';
      order.reconciliationStatus = 'MATCHED';
      order.refundedAt = new Date();
      order.transactions = order.transactions || [];
      order.transactions.push({
        type: 'REFUND_CREATED',
        transactionId: order.paymentTransactionId,
        amount: order.price,
        method: order.paymentMethod || 'BANK_TRANSFER',
        status: 'REFUNDED',
        note: resolution || 'Admin duyệt hoàn tiền',
      });
    }

    order.paymentIssueStatus = action === 'REJECT' ? 'REJECTED' : 'RESOLVED';
    order.paymentIssueResolution = resolution;
    order.paymentIssueResolvedBy = adminId;
    order.paymentIssueResolvedAt = new Date();
    order.paymentIssueTimeline = order.paymentIssueTimeline || [];
    order.paymentIssueTimeline.push({
      action: order.paymentIssueStatus,
      actorId: adminId,
      actorRole: 'ADMIN',
      note: resolution,
    });
    await order.save();

    await publishOrderEvent('order.payment_issue.resolved', {
      orderId: order._id.toString(),
      productId: order.productId,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      price: order.price,
      action,
      status: order.paymentIssueStatus,
    });

    return order.toObject();
  }

  async getAdminOrders({ page = 1, size = 20, status, paymentStatus, disputeStatus, paymentIssueStatus } = {}) {
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (paymentStatus && paymentStatus !== 'ALL') filter.paymentStatus = paymentStatus;
    if (disputeStatus && disputeStatus !== 'ALL') filter.disputeStatus = disputeStatus;
    if (paymentIssueStatus && paymentIssueStatus !== 'ALL') filter.paymentIssueStatus = paymentIssueStatus;

    const skip = (page - 1) * size;
    const [orders, totalElements] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
      Order.countDocuments(filter),
    ]);

    return {
      content: orders,
      page,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
      last: page * size >= totalElements,
    };
  }

  async getAdminOrderStats() {
    const [total, completed, cancelled, paid, refunded, disputesOpen, paymentIssuesOpen] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'COMPLETED' }),
      Order.countDocuments({ status: 'CANCELLED' }),
      Order.countDocuments({ paymentStatus: 'PAID' }),
      Order.countDocuments({ paymentStatus: 'REFUNDED' }),
      Order.countDocuments({ disputeStatus: 'OPEN' }),
      Order.countDocuments({ paymentIssueStatus: 'OPEN' }),
    ]);

    const revenueAgg = await Order.aggregate([
      { $match: { paymentStatus: { $in: ['PAID', 'REFUNDED'] } } },
      { $group: { _id: '$paymentStatus', total: { $sum: '$price' }, count: { $sum: 1 } } },
    ]);

    const totals = revenueAgg.reduce((acc, item) => {
      acc[item._id] = { amount: item.total, count: item.count };
      return acc;
    }, {});

    return {
      total,
      completed,
      cancelled,
      paid,
      refunded,
      disputesOpen,
      paymentIssuesOpen,
      grossPaymentAmount: totals.PAID?.amount || 0,
      refundedAmount: totals.REFUNDED?.amount || 0,
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
    };
  }

  /**
   * Build an order receipt with status timeline and transaction ledger.
   *
   * @param {string} orderId
   * @param {string} userId
   * @returns {object} Receipt data
   */
  async getReceipt(orderId, userId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
      throw new ForbiddenException('Bạn không có quyền xem biên nhận đơn hàng này');
    }

    if (!order.receiptNumber && (order.paymentStatus !== 'UNPAID' || order.status === 'COMPLETED')) {
      order.receiptNumber = buildReceiptNumber(order);
      await order.save();
    }

    const plain = order.toObject();
    return {
      receiptNumber: plain.receiptNumber || null,
      orderId: plain._id.toString(),
      buyerId: plain.buyerId,
      sellerId: plain.sellerId,
      productId: plain.productId,
      amount: plain.price,
      orderStatus: plain.status,
      paymentStatus: plain.paymentStatus,
      paymentMethod: plain.paymentMethod,
      transactionId: plain.paymentTransactionId,
      transferProofUrl: plain.transferProofUrl,
      transferReportedAt: plain.transferReportedAt,
      transferConfirmedAt: plain.transferConfirmedAt,
      createdAt: plain.createdAt,
      paidAt: plain.paidAt,
      refundedAt: plain.refundedAt,
      completedAt: plain.completedAt,
      statusHistory: plain.statusHistory || [],
      transactions: plain.transactions || [],
    };
  }

  /**
   * Assert that a status transition is valid.
   *
   * @param {string} current
   * @param {string} next
   * @private
   */
  _assertTransition(current, next) {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.has(next)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${current} sang ${next}`
      );
    }
  }
}
