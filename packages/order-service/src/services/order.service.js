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
} from './saga.service.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

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
}

function buildReceiptNumber(order) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = order._id.toString().slice(-6).toUpperCase();
  return `IUH-${datePart}-${suffix}`;
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
          price: request.price,
          buyerNote: request.buyerNote || '',
          handoverLocation: request.handoverLocation || '',
          handoverTime: request.handoverTime || null,
          handoverStatus: request.handoverLocation && request.handoverTime ? 'PROPOSED' : 'NOT_SCHEDULED',
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
  async rejectOrder(orderId, sellerId, reason) {
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
  async cancelByBuyer(orderId, buyerId, reason) {
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

  /**
   * Get a single order by ID.
   *
   * @param {string} orderId
   * @returns {object} Order
   */
  async getOrderById(orderId) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }
    return order;
  }

  async getReviewEligibility(orderId, userId) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    const eligible =
      String(order.buyerId) === String(userId) &&
      order.status === 'COMPLETED' &&
      order.disputeStatus !== 'OPEN';

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

    if (order.status !== 'COMPLETED' && order.paymentStatus !== 'PAID') {
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
    }
    await order.save();
    return order.toObject();
  }

  async confirmHandover(orderId, userId) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    const role = actorRoleFor(order, userId);
    if (role === 'SYSTEM') throw new ForbiddenException('Bạn không có quyền xác nhận giao nhận cho đơn này');
    if (!['AWAITING_SELLER', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException('Chỉ có thể xác nhận giao nhận khi đơn đã được giữ chỗ hoặc hoàn tất');
    }

    if (role === 'BUYER') {
      order.buyerHandoverConfirmedAt = new Date();
    } else {
      order.sellerHandoverConfirmedAt = new Date();
    }

    if (order.buyerHandoverConfirmedAt && order.sellerHandoverConfirmedAt) {
      order.handoverStatus = 'HANDED_OVER';
    } else {
      order.handoverStatus = role === 'BUYER' ? 'BUYER_CONFIRMED' : 'SELLER_CONFIRMED';
    }
    await order.save();
    return order.toObject();
  }

  async resolveDispute(orderId, adminId, { status, resolution }) {
    const order = await Order.findById(orderId);
    if (!order) throw new ResourceNotFoundException('Order', orderId);
    if (order.disputeStatus !== 'OPEN') {
      throw new BadRequestException('Đơn hàng không có tranh chấp đang mở');
    }

    order.disputeStatus = status === 'REJECTED' ? 'REJECTED' : 'RESOLVED';
    order.disputeResolution = resolution || '';
    order.disputeResolvedBy = adminId;
    order.disputeResolvedAt = new Date();
    order.disputeTimeline = order.disputeTimeline || [];
    order.disputeTimeline.push({
      action: order.disputeStatus,
      actorId: adminId,
      actorRole: 'ADMIN',
      note: resolution || '',
    });
    await order.save();

    return order.toObject();
  }

  async getAdminOrders({ page = 1, size = 20, status, paymentStatus, disputeStatus } = {}) {
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (paymentStatus && paymentStatus !== 'ALL') filter.paymentStatus = paymentStatus;
    if (disputeStatus && disputeStatus !== 'ALL') filter.disputeStatus = disputeStatus;

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
    const [total, completed, cancelled, paid, refunded, disputesOpen] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'COMPLETED' }),
      Order.countDocuments({ status: 'CANCELLED' }),
      Order.countDocuments({ paymentStatus: 'PAID' }),
      Order.countDocuments({ paymentStatus: 'REFUNDED' }),
      Order.countDocuments({ disputeStatus: 'OPEN' }),
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
