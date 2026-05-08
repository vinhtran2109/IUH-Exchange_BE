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

    const { productId, sellerId, price, buyerNote } = req.body;

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

    const result = await this.orderService.getOrders(userId, { page, size, status, role });

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
}
