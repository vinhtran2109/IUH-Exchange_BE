import { ApiResponse, BadRequestException } from '@iuh-exchange/common';

/**
 * Order Controller - HTTP layer for order endpoints.
 * Delegates all business logic to OrderService.
 */
export class OrderController {
  /**
   * @param {import('../services/order.service.js').OrderService} orderService
   */
  constructor(orderService) {
    this.orderService = orderService;
  }

  /**
   * POST /api/v1/orders
   * Create a new order.
   *
   * Headers:
   *   X-User-Id: buyer's user ID (injected by API Gateway)
   *   Idempotency-Key: unique key per order attempt
   *
   * Body: { productId, sellerId, price, buyerNote? }
   */
  async createOrder(req, res) {
    const buyerId = req.headers['x-user-id'];
    if (!buyerId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;
    if (!idempotencyKey) {
      throw new BadRequestException('Missing Idempotency-Key header');
    }

    const { productId, sellerId, price, buyerNote, handoverLocation, handoverTime } = req.body;

    if (!productId || !sellerId || price === undefined) {
      throw new BadRequestException('productId, sellerId, and price are required');
    }

    if (typeof price !== 'number' || price <= 0) {
      throw new BadRequestException('price must be a positive number');
    }

    const order = await this.orderService.createOrder(buyerId, {
      productId,
      sellerId,
      price,
      buyerNote,
      handoverLocation,
      handoverTime,
      idempotencyKey,
    });

    return res.status(201).json(ApiResponse.created(order));
  }

  /**
   * GET /api/v1/orders
   * List orders for the authenticated user (paginated).
   *
   * Query params: page, size, status, role (buyer|seller)
   */
  async getOrders(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
    const status = req.query.status || undefined;
    const role = req.query.role || 'buyer';
    const productId = req.query.productId || undefined;

    const result = await this.orderService.getOrders(userId, { page, size, status, role, productId });

    return res.json(ApiResponse.ok(result));
  }

  /**
   * GET /api/v1/orders/my-orders
   * Get all orders where the authenticated user is buyer OR seller.
   */
  async getMyOrders(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const orders = await this.orderService.getMyOrders(userId);
    return res.json(ApiResponse.ok(orders));
  }

  /**
   * GET /api/v1/orders/:id
   * Get a single order by ID.
   */
  async getOrderById(req, res) {
    const order = await this.orderService.getOrderById(req.params.id);
    return res.json(ApiResponse.ok(order));
  }

  /**
   * GET /api/v1/orders/:id/receipt
   * Get receipt data, status timeline, and transaction ledger.
   */
  async getReceipt(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const receipt = await this.orderService.getReceipt(req.params.id, userId);
    return res.json(ApiResponse.ok(receipt));
  }

  async getReviewEligibility(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const result = await this.orderService.getReviewEligibility(req.params.id, userId);
    return res.json(ApiResponse.ok(result));
  }

  async openDispute(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) throw new BadRequestException('Dispute reason must be at least 10 characters');
    const order = await this.orderService.openDispute(req.params.id, userId, reason);
    return res.status(201).json(ApiResponse.created(order, 'Dispute opened'));
  }

  async addDisputeEvidence(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const url = String(req.body?.url || '').trim();
    if (!url) throw new BadRequestException('Evidence url is required');
    const order = await this.orderService.addDisputeEvidence(req.params.id, userId, {
      type: req.body?.type || 'OTHER',
      url,
      note: String(req.body?.note || '').trim(),
    });
    return res.status(201).json(ApiResponse.created(order, 'Evidence added'));
  }

  async proposeHandover(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const location = String(req.body?.location || '').trim();
    const time = req.body?.time ? new Date(req.body.time) : null;
    if (!location || !time || Number.isNaN(time.getTime())) {
      throw new BadRequestException('Valid location and time are required');
    }
    const order = await this.orderService.proposeHandover(req.params.id, userId, {
      location,
      time,
      note: String(req.body?.note || '').trim(),
    });
    return res.status(201).json(ApiResponse.created(order, 'Handover proposed'));
  }

  async respondHandover(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const action = String(req.body?.action || '').toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(action)) throw new BadRequestException('action must be ACCEPT or REJECT');
    const order = await this.orderService.respondHandover(req.params.id, userId, {
      proposalId: req.params.proposalId,
      action,
    });
    return res.json(ApiResponse.ok(order, 'Handover proposal updated'));
  }

  async confirmHandover(req, res) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    const order = await this.orderService.confirmHandover(req.params.id, userId);
    return res.json(ApiResponse.ok(order, 'Handover confirmed'));
  }

  async getAdminOrders(req, res) {
    if (req.headers['x-user-role'] !== 'ADMIN' && req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Admin access required');
    }
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
    const result = await this.orderService.getAdminOrders({
      page,
      size,
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      disputeStatus: req.query.disputeStatus,
    });
    return res.json(ApiResponse.ok(result));
  }

  async getAdminOrderStats(req, res) {
    if (req.headers['x-user-role'] !== 'ADMIN' && req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Admin access required');
    }
    const result = await this.orderService.getAdminOrderStats();
    return res.json(ApiResponse.ok(result));
  }

  async resolveDispute(req, res) {
    const role = req.headers['x-user-role'] || req.user?.role;
    const adminId = req.headers['x-user-id'] || req.user?.sub;
    if (role !== 'ADMIN') throw new BadRequestException('Admin access required');
    const status = req.body?.status === 'REJECTED' ? 'REJECTED' : 'RESOLVED';
    const resolution = String(req.body?.resolution || '').trim();
    const order = await this.orderService.resolveDispute(req.params.id, adminId, { status, resolution });
    return res.json(ApiResponse.ok(order, 'Dispute resolved'));
  }

  /**
   * POST /api/v1/orders/:id/confirm
   * Seller confirms an order (completes the transaction).
   */
  async confirmOrder(req, res) {
    const sellerId = req.headers['x-user-id'];
    if (!sellerId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const order = await this.orderService.confirmOrder(req.params.id, sellerId);
    return res.json(ApiResponse.ok(order, 'Order confirmed'));
  }

  /**
   * PATCH /api/v1/orders/:id/reject
   * Seller rejects an order (cancels it).
   *
   * Body (optional): { reason?: string }
   */
  async rejectOrder(req, res) {
    const sellerId = req.headers['x-user-id'];
    if (!sellerId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const reason = req.body?.reason || 'Người bán từ chối đơn hàng';
    const order = await this.orderService.rejectOrder(req.params.id, sellerId, reason);
    return res.json(ApiResponse.ok(order, 'Order rejected'));
  }

  /**
   * PATCH /api/v1/orders/:id/cancel
   * Buyer cancels their own order.
   *
   * Body (optional): { reason?: string }
   */
  async cancelOrder(req, res) {
    const buyerId = req.headers['x-user-id'];
    if (!buyerId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const reason = req.body?.reason || 'Người mua hủy đơn hàng';
    const order = await this.orderService.cancelByBuyer(req.params.id, buyerId, reason);
    return res.json(ApiResponse.ok(order, 'Order cancelled'));
  }
}
