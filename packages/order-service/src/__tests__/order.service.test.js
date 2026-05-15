import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockOrder = {
  _id: 'order123',
  buyerId: 'buyer123',
  sellerId: 'seller123',
  productId: 'prod123',
  price: 50000,
  buyerNote: 'Giao tại trường',
  idempotencyKey: 'idem-key-001',
  status: 'PENDING',
  createdAt: new Date(),
  save: vi.fn(),
  toObject: vi.fn().mockReturnThis(),
};

const mockOrderModel = {
  find: vi.fn().mockReturnThis(),
  findById: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  create: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockPublishOrderCreated = vi.fn().mockResolvedValue(true);
const mockPublishOrderCancelled = vi.fn().mockResolvedValue(true);
const mockPublishOrderCompleted = vi.fn().mockResolvedValue(true);
const mockPublishOrderEvent = vi.fn().mockResolvedValue(true);

vi.mock('../models/Order.js', () => ({
  Order: mockOrderModel,
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRedis: () => mockRedis,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

vi.mock('../services/saga.service.js', () => ({
  publishOrderCreated: (...args) => mockPublishOrderCreated(...args),
  publishOrderCancelled: (...args) => mockPublishOrderCancelled(...args),
  publishOrderCompleted: (...args) => mockPublishOrderCompleted(...args),
  publishOrderDisputeOpened: vi.fn().mockResolvedValue(true),
  publishOrderEvent: (...args) => mockPublishOrderEvent(...args),
}));

const { OrderService } = await import('../services/order.service.js');
const orderService = new OrderService();

describe('order.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderModel.find.mockReturnThis();
    mockOrderModel.sort.mockReturnThis();
    mockOrderModel.skip.mockReturnThis();
    mockOrderModel.limit.mockReturnThis();
    mockOrderModel.lean.mockReturnThis();
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      // Idempotency key not in Redis
      mockRedis.get.mockResolvedValue(null);
      // NX succeeds
      mockRedis.set.mockResolvedValue('OK');
      // Order.create succeeds
      mockOrderModel.create.mockResolvedValue({
        ...mockOrder,
        toObject: () => ({ ...mockOrder }),
      });

      const result = await orderService.createOrder('buyer123', {
        productId: 'prod123',
        sellerId: 'seller123',
        price: 50000,
        buyerNote: 'Giao tại trường',
        idempotencyKey: 'idem-key-001',
      });

      expect(result).toBeDefined();
      expect(mockOrderModel.create).toHaveBeenCalled();
      expect(mockPublishOrderCreated).toHaveBeenCalled();
    });

    it('should return cached order for duplicate request', async () => {
      // Idempotency key exists in Redis
      mockRedis.get.mockResolvedValue('existing-order-id');
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        _id: 'existing-order-id',
        toObject: () => ({ ...mockOrder, _id: 'existing-order-id' }),
      });

      const result = await orderService.createOrder('buyer123', {
        productId: 'prod123',
        sellerId: 'seller123',
        price: 50000,
        idempotencyKey: 'idem-key-001',
      });

      expect(result._id).toBe('existing-order-id');
      expect(mockOrderModel.create).not.toHaveBeenCalled();
    });

    it('should reject self-purchase', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      await expect(
        orderService.createOrder('same-user', {
          productId: 'prod123',
          sellerId: 'same-user',
          price: 50000,
          idempotencyKey: 'idem-key-002',
        })
      ).rejects.toThrow('không thể mua sản phẩm của chính mình');
    });

    it('should handle race condition duplicate key error (code 11000)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      // First create throws duplicate key
      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      mockOrderModel.create.mockRejectedValue(dupError);
      // findOne returns existing order
      mockOrderModel.findOne.mockResolvedValue({
        ...mockOrder,
        toObject: () => ({ ...mockOrder }),
      });

      const result = await orderService.createOrder('buyer123', {
        productId: 'prod123',
        sellerId: 'seller123',
        price: 50000,
        idempotencyKey: 'idem-key-race',
      });

      expect(result).toBeDefined();
      expect(mockOrderModel.findOne).toHaveBeenCalled();
    });

    it('should validate accepted offer before creating order from offer', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            offerId: 'offer123',
            productId: 'prod123',
            sellerId: 'seller123',
            buyerId: 'buyer123',
            price: 42000,
            listingType: 'SELL',
          },
        }),
      });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockOrderModel.create.mockResolvedValue({
        ...mockOrder,
        offerId: 'offer123',
        price: 42000,
        toObject: () => ({ ...mockOrder, offerId: 'offer123', price: 42000 }),
      });

      const result = await orderService.createOrder('buyer123', {
        offerId: 'offer123',
        idempotencyKey: 'idem-offer-001',
      });

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/offers/offer123/checkout'), expect.any(Object));
      expect(mockOrderModel.create).toHaveBeenCalledWith(expect.objectContaining({
        offerId: 'offer123',
        productId: 'prod123',
        sellerId: 'seller123',
        price: 42000,
      }));
      expect(result.offerId).toBe('offer123');
      fetchSpy.mockRestore();
    });
  });

  describe('confirmOrder', () => {
    it('should confirm order successfully', async () => {
      const order = {
        ...mockOrder,
        status: 'AWAITING_SELLER',
        sellerId: 'seller123',
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ ...mockOrder, status: 'COMPLETED' }),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await orderService.confirmOrder('order123', 'seller123');

      expect(order.status).toBe('COMPLETED');
      expect(order.save).toHaveBeenCalled();
      expect(mockPublishOrderCompleted).toHaveBeenCalled();
    });

    it('should reject confirm from non-seller', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        sellerId: 'seller123',
        status: 'AWAITING_SELLER',
      });

      await expect(
        orderService.confirmOrder('order123', 'wrong-seller')
      ).rejects.toThrow('không có quyền');
    });

    it('should reject confirm for non-AWAITING_SELLER order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        sellerId: 'seller123',
        status: 'PENDING',
      });

      await expect(
        orderService.confirmOrder('order123', 'seller123')
      ).rejects.toThrow('không ở trạng thái chờ xác nhận');
    });

    it('should throw 404 for missing order', async () => {
      mockOrderModel.findById.mockResolvedValue(null);
      await expect(
        orderService.confirmOrder('nonexistent', 'seller123')
      ).rejects.toThrow();
    });
  });

  describe('rejectOrder', () => {
    it('should reject order and publish cancellation event', async () => {
      const order = {
        ...mockOrder,
        status: 'AWAITING_SELLER',
        sellerId: 'seller123',
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ ...mockOrder, status: 'CANCELLED' }),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await orderService.rejectOrder('order123', 'seller123', 'Không muốn bán');

      expect(order.status).toBe('CANCELLED');
      expect(mockPublishOrderCancelled).toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order via saga compensating transaction', async () => {
      const order = {
        ...mockOrder,
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.cancelOrder('order123', 'Product not available');

      expect(order.status).toBe('CANCELLED');
      expect(mockPublishOrderCancelled).toHaveBeenCalled();
    });

    it('should not cancel completed order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      // Should not throw but should log warning
      await orderService.cancelOrder('order123', 'test');
      expect(mockPublishOrderCancelled).not.toHaveBeenCalled();
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const orders = [{ ...mockOrder }];
      mockOrderModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(orders),
            }),
          }),
        }),
      });
      mockOrderModel.countDocuments.mockResolvedValue(1);

      const result = await orderService.getOrders('buyer123', { page: 1, size: 20, role: 'buyer' });

      expect(result.content).toHaveLength(1);
      expect(result.totalElements).toBe(1);
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID', async () => {
      mockOrderModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ ...mockOrder }),
      });

      const result = await orderService.getOrderById('order123');
      expect(result).toBeDefined();
      expect(result._id).toBe('order123');
    });

    it('should throw 404 for missing order', async () => {
      mockOrderModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(orderService.getOrderById('nonexistent')).rejects.toThrow();
    });
  });

  describe('cancelByBuyer', () => {
    it('should allow buyer to cancel PENDING order', async () => {
      const order = {
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ ...mockOrder, status: 'CANCELLED' }),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await orderService.cancelByBuyer('order123', 'buyer123', 'Changed mind');

      expect(order.status).toBe('CANCELLED');
      expect(order.save).toHaveBeenCalled();
      expect(mockPublishOrderCancelled).toHaveBeenCalled();
    });

    it('should allow buyer to cancel AWAITING_SELLER order', async () => {
      const order = {
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'AWAITING_SELLER',
        save: vi.fn().mockResolvedValue(true),
        toObject: () => ({ ...mockOrder, status: 'CANCELLED' }),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const result = await orderService.cancelByBuyer('order123', 'buyer123');

      expect(order.status).toBe('CANCELLED');
      expect(mockPublishOrderCancelled).toHaveBeenCalled();
    });

    it('should reject cancel from non-buyer', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'PENDING',
      });

      await expect(
        orderService.cancelByBuyer('order123', 'other-user')
      ).rejects.toThrow('không có quyền');
    });

    it('should reject cancel of COMPLETED order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'COMPLETED',
      });

      await expect(
        orderService.cancelByBuyer('order123', 'buyer123')
      ).rejects.toThrow('đã hoàn tất');
    });

    it('should reject cancel of already CANCELLED order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'CANCELLED',
      });

      await expect(
        orderService.cancelByBuyer('order123', 'buyer123')
      ).rejects.toThrow('đã bị hủy');
    });

    it('should throw 404 for missing order', async () => {
      mockOrderModel.findById.mockResolvedValue(null);

      await expect(
        orderService.cancelByBuyer('nonexistent', 'buyer123')
      ).rejects.toThrow();
    });
  });

  describe('markAwaitingSellerConfirmation', () => {
    it('should update order status to AWAITING_SELLER', async () => {
      const order = {
        ...mockOrder,
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.markAwaitingSellerConfirmation('order123');

      expect(order.status).toBe('AWAITING_SELLER');
      expect(order.save).toHaveBeenCalled();
    });

    it('should skip terminal orders', async () => {
      const order = { ...mockOrder, status: 'CANCELLED', save: vi.fn() };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.markAwaitingSellerConfirmation('order123');

      expect(order.save).not.toHaveBeenCalled();
    });
  });

  describe('handover scheduling', () => {
    it('should create a handover proposal', async () => {
      const order = {
        ...mockOrder,
        status: 'AWAITING_SELLER',
        meetingProposals: [],
        save: vi.fn().mockResolvedValue(true),
        toObject() { return this; },
      };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.proposeHandover('order123', 'buyer123', {
        location: 'Thư viện IUH',
        time: new Date(Date.now() + 3600000),
        note: 'Gặp ở tầng 1',
      });

      expect(order.handoverStatus).toBe('PROPOSED');
      expect(order.meetingProposals).toHaveLength(1);
      expect(order.save).toHaveBeenCalled();
    });

    it('should mark handover as handed over after both sides confirm', async () => {
      const order = {
        ...mockOrder,
        status: 'AWAITING_SELLER',
        buyerHandoverConfirmedAt: new Date(),
        sellerHandoverConfirmedAt: null,
        save: vi.fn().mockResolvedValue(true),
        toObject() { return this; },
      };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.confirmHandover('order123', 'seller123');

      expect(order.handoverStatus).toBe('HANDED_OVER');
      expect(order.sellerHandoverConfirmedAt).toBeTruthy();
    });
  });

  describe('dispute evidence', () => {
    it('should append evidence and dispute timeline entries', async () => {
      const order = {
        ...mockOrder,
        status: 'COMPLETED',
        disputeStatus: 'OPEN',
        disputeEvidence: [],
        disputeTimeline: [],
        save: vi.fn().mockResolvedValue(true),
        toObject() { return this; },
      };
      mockOrderModel.findById.mockResolvedValue(order);

      await orderService.addDisputeEvidence('order123', 'buyer123', {
        type: 'IMAGE',
        url: 'https://example.com/evidence.jpg',
        note: 'Hàng bị trầy',
      });

      expect(order.disputeEvidence).toHaveLength(1);
      expect(order.disputeTimeline[0].action).toBe('EVIDENCE_ADDED');
      expect(order.save).toHaveBeenCalled();
    });
  });
});
