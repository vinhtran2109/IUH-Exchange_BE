import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockOrder = {
  _id: 'order123',
  buyerId: 'buyer123',
  sellerId: 'seller123',
  productId: 'prod123',
  price: 50000,
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  paymentMethod: 'NONE',
  paymentTransactionId: null,
  paidAt: null,
  refundedAt: null,
  save: vi.fn().mockResolvedValue(true),
  toObject: vi.fn().mockReturnThis(),
};

const mockOrderModel = {
  findById: vi.fn(),
  find: vi.fn().mockReturnThis(),
};

vi.mock('../models/Order.js', () => ({
  Order: mockOrderModel,
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const mockPublishOrderEvent = vi.fn().mockResolvedValue(true);
const mockPublishOrderRefunded = vi.fn().mockResolvedValue(true);

vi.mock('../services/saga.service.js', () => ({
  publishOrderEvent: (...args) => mockPublishOrderEvent(...args),
  publishOrderRefunded: (...args) => mockPublishOrderRefunded(...args),
}));

const paymentController = await import('../controllers/payment.controller.js');

function mockReqRes(body = {}, params = {}, headers = {}) {
  const req = {
    body,
    params,
    headers: {
      'x-user-id': 'buyer123',
      ...headers,
    },
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('payment.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create mock VNPay payment URL', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        save: vi.fn().mockResolvedValue(true),
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await paymentController.createPayment(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.paymentUrl).toBeDefined();
      expect(response.data.transactionId).toBeDefined();
      expect(response.data.method).toBe('VNPAY_MOCK');
    });

    it('should reject if order already paid', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await expect(paymentController.createPayment(req, res)).rejects.toThrow('đã được thanh toán');
    });

    it('should reject if order is cancelled', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await expect(paymentController.createPayment(req, res)).rejects.toThrow('đã bị hủy');
    });

    it('should reject if not the buyer', async () => {
      mockOrderModel.findById.mockResolvedValue(mockOrder);

      const { req, res } = mockReqRes({}, { id: 'order123' }, { 'x-user-id': 'other-user' });
      await expect(paymentController.createPayment(req, res)).rejects.toThrow('Chỉ người mua');
    });

    it('should throw 404 for missing order', async () => {
      mockOrderModel.findById.mockResolvedValue(null);

      const { req, res } = mockReqRes({}, { id: 'nonexistent' });
      await expect(paymentController.createPayment(req, res)).rejects.toThrow();
    });
  });

  describe('paymentCallback', () => {
    it('should confirm payment successfully', async () => {
      const order = {
        ...mockOrder,
        paymentTransactionId: 'VNPAY_123_abc',
        paymentStatus: 'UNPAID',
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const { req, res } = mockReqRes(
        { transactionId: 'VNPAY_123_abc', status: 'success' },
        { id: 'order123' }
      );
      await paymentController.paymentCallback(req, res);

      expect(order.paymentStatus).toBe('PAID');
      expect(order.paidAt).toBeDefined();
      expect(order.save).toHaveBeenCalled();
      expect(mockPublishOrderEvent).toHaveBeenCalledWith(
        'order.payment.confirmed',
        expect.objectContaining({
          orderId: 'order123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          productId: 'prod123',
        })
      );
    });

    it('should reject duplicate payment', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
      });

      const { req, res } = mockReqRes(
        { transactionId: 'VNPAY_123_abc', status: 'success' },
        { id: 'order123' }
      );
      await expect(paymentController.paymentCallback(req, res)).rejects.toThrow('đã được thanh toán trước đó');
    });

    it('should reject invalid transaction ID', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentTransactionId: 'VNPAY_123_abc',
      });

      const { req, res } = mockReqRes(
        { transactionId: 'WRONG_ID', status: 'success' },
        { id: 'order123' }
      );
      await expect(paymentController.paymentCallback(req, res)).rejects.toThrow('không hợp lệ');
    });

    it('should reject callback for cancelled order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        paymentStatus: 'UNPAID',
        paymentTransactionId: 'VNPAY_123_abc',
      });

      const { req, res } = mockReqRes(
        { transactionId: 'VNPAY_123_abc', status: 'success' },
        { id: 'order123' }
      );
      await expect(paymentController.paymentCallback(req, res)).rejects.toThrow('đã bị hủy');
    });

    it('should reject callback for refunded order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
        paymentStatus: 'REFUNDED',
        paymentTransactionId: 'VNPAY_123_abc',
      });

      const { req, res } = mockReqRes(
        { transactionId: 'VNPAY_123_abc', status: 'success' },
        { id: 'order123' }
      );
      await expect(paymentController.paymentCallback(req, res)).rejects.toThrow('đã được hoàn tiền');
    });
  });

  describe('bank transfer payment', () => {
    it('should let buyer report a direct bank transfer', async () => {
      const order = {
        ...mockOrder,
        transactions: [],
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const { req, res } = mockReqRes({ proofUrl: 'https://example.com/proof.jpg' }, { id: 'order123' });
      await paymentController.reportBankTransfer(req, res);

      expect(order.paymentMethod).toBe('BANK_TRANSFER');
      expect(order.paymentProviderStatus).toBe('TRANSFER_REPORTED');
      expect(order.transferReportedAt).toBeDefined();
      expect(order.transactions.at(-1)).toMatchObject({
        type: 'TRANSFER_REPORTED',
        method: 'BANK_TRANSFER',
        status: 'REPORTED',
      });
      expect(mockPublishOrderEvent).toHaveBeenCalledWith(
        'order.payment.reported',
        expect.objectContaining({
          orderId: 'order123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          productId: 'prod123',
        })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('should reject bank transfer report from non-buyer', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        transactions: [],
      });

      const { req, res } = mockReqRes({}, { id: 'order123' }, { 'x-user-id': 'seller123' });
      await expect(paymentController.reportBankTransfer(req, res)).rejects.toThrow('người mua');
    });

    it('should let seller confirm a reported bank transfer', async () => {
      const order = {
        ...mockOrder,
        paymentMethod: 'BANK_TRANSFER',
        paymentTransactionId: 'BANK_123',
        transferReportedAt: new Date(),
        transactions: [],
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const { req, res } = mockReqRes({}, { id: 'order123' }, { 'x-user-id': 'seller123' });
      await paymentController.confirmBankTransfer(req, res);

      expect(order.paymentStatus).toBe('PAID');
      expect(order.paymentProviderStatus).toBe('TRANSFER_CONFIRMED');
      expect(order.transferConfirmedBy).toBe('seller123');
      expect(order.transactions.at(-1)).toMatchObject({
        type: 'TRANSFER_CONFIRMED',
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
      });
      expect(mockPublishOrderEvent).toHaveBeenCalledWith(
        'order.payment.confirmed',
        expect.objectContaining({
          orderId: 'order123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          productId: 'prod123',
        })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('should reject transfer confirmation before buyer reports it', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentMethod: 'BANK_TRANSFER',
        transferReportedAt: null,
        transactions: [],
      });

      const { req, res } = mockReqRes({}, { id: 'order123' }, { 'x-user-id': 'seller123' });
      await expect(paymentController.confirmBankTransfer(req, res)).rejects.toThrow('chưa báo');
    });
  });

  describe('processRefund', () => {
    it('should process refund for cancelled paid order', async () => {
      const order = {
        ...mockOrder,
        buyerId: 'buyer123',
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        save: vi.fn().mockResolvedValue(true),
      };
      mockOrderModel.findById.mockResolvedValue(order);

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await paymentController.processRefund(req, res);

      expect(order.paymentStatus).toBe('REFUNDED');
      expect(order.refundedAt).toBeDefined();
    });

    it('should reject refund for unpaid order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'UNPAID',
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await expect(paymentController.processRefund(req, res)).rejects.toThrow('chưa được thanh toán');
    });

    it('should reject refund for non-cancelled order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await expect(paymentController.processRefund(req, res)).rejects.toThrow('đã bị hủy');
    });

    it('should reject duplicate refund', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'REFUNDED',
        status: 'CANCELLED',
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await expect(paymentController.processRefund(req, res)).rejects.toThrow('đã được hoàn tiền trước đó');
    });
  });

  describe('getPaymentDetails', () => {
    it('should return payment details', async () => {
      mockOrderModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ ...mockOrder }),
      });

      const { req, res } = mockReqRes({}, { id: 'order123' });
      await paymentController.getPaymentDetails(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.paymentStatus).toBe('UNPAID');
    });

    it('should reject payment details access from unrelated user', async () => {
      mockOrderModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ ...mockOrder }),
      });

      const { req, res } = mockReqRes({}, { id: 'order123' }, { 'x-user-id': 'stranger' });
      await expect(paymentController.getPaymentDetails(req, res)).rejects.toThrow('không có quyền');
    });
  });
});
