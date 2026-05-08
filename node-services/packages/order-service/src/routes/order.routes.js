import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';

/**
 * Create order routes.
 *
 * @param {import('../services/order.service.js').OrderService} orderService
 * @returns {Router}
 */
export function createOrderRoutes(orderService) {
  const router = Router();
  const controller = new OrderController(orderService);

  /**
   * POST /api/v1/orders
   * Create a new order.
   * Headers: X-User-Id (API Gateway), Idempotency-Key (Frontend)
   * Body: { productId, sellerId, price, buyerNote? }
   */
  router.post('/', (req, res, next) => {
    controller.createOrder(req, res).catch(next);
  });

  /**
   * GET /api/v1/orders
   * List orders for the authenticated user (paginated).
   * Query: page, size, status, role (buyer|seller)
   */
  router.get('/', (req, res, next) => {
    controller.getOrders(req, res).catch(next);
  });

  /**
   * GET /api/v1/orders/:id
   * Get a single order by ID.
   */
  router.get('/:id', (req, res, next) => {
    controller.getOrderById(req, res).catch(next);
  });

  /**
   * POST /api/v1/orders/:id/confirm
   * Seller confirms an order → completes the transaction.
   */
  router.post('/:id/confirm', (req, res, next) => {
    controller.confirmOrder(req, res).catch(next);
  });

  /**
   * PATCH /api/v1/orders/:id/reject
   * Seller rejects an order → cancels it.
   * Body (optional): { reason? }
   */
  router.patch('/:id/reject', (req, res, next) => {
    controller.rejectOrder(req, res).catch(next);
  });

  return router;
}
