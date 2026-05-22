import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external dependencies before imports ──
vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createConsumer: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('../models/Notification.js', () => ({
  Notification: {
    create: vi.fn().mockResolvedValue({
      toObject: () => ({ _id: 'notif-1', recipientId: 'user-1', title: 'Test', message: 'Test msg' }),
    }),
  },
}));

vi.mock('../models/DlqEvent.js', () => ({
  DlqEvent: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../models/FcmToken.js', () => ({
  FcmToken: {
    find: vi.fn().mockResolvedValue([{ token: 'fcm-token-1', isActive: true }]),
  },
}));

vi.mock('../models/NotificationPreference.js', () => ({
  NotificationPreference: {
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  },
}));

vi.mock('../services/socket.service.js', () => ({
  publishNotification: vi.fn(),
}));

vi.mock('../services/email.service.js', () => ({
  sendOrderEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/fcm.service.js', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
}));

import { createConsumer } from '@iuh-exchange/common';
import { Notification } from '../models/Notification.js';
import { DlqEvent } from '../models/DlqEvent.js';
import { FcmToken } from '../models/FcmToken.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { publishNotification } from '../services/socket.service.js';
import { sendOrderEmail } from '../services/email.service.js';
import { sendPushNotification } from '../services/fcm.service.js';

describe('kafka-consumer.service', () => {
  let eachMessage;
  let mockConsumer;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (url) => {
      const target = String(url);
      if (target.includes('/api/v1/users/by-student/')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'student-owner-1' } }),
        };
      }
      if (target.includes('/api/v1/users/buyer-1')) {
        return {
          ok: true,
          json: async () => ({
            data: { name: 'Nguyễn Văn Buyer', email: 'buyer@example.com', studentId: '21000001' },
          }),
        };
      }
      if (target.includes('/api/v1/users/seller-1')) {
        return {
          ok: true,
          json: async () => ({
            data: { name: 'Trần Thị Seller', email: 'seller@example.com', studentId: '21000002' },
          }),
        };
      }
      if (target.includes('/api/v1/products/prod-1')) {
        return {
          ok: true,
          json: async () => ({
            data: { title: 'Giáo trình kỹ thuật đo điện', price: 15000, category: 'BOOK', condition: 'USED' },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ data: { name: 'Test User', email: 'user@example.com', studentId: '21000000' } }),
      };
    });

    // Setup mock consumer
    mockConsumer = {
      run: vi.fn().mockImplementation(async ({ eachMessage: handler }) => {
        eachMessage = handler;
      }),
    };
    createConsumer.mockResolvedValue(mockConsumer);

    // Import the module to trigger createConsumer call
    vi.resetModules();
    const mod = await import('../services/kafka-consumer.service.js');
    await mod.startKafkaConsumer();
  });

  async function simulateKafkaMessage(topic, payload) {
    const message = {
      value: Buffer.from(JSON.stringify(payload)),
      offset: '0',
    };
    await eachMessage({ topic, partition: 0, message });
  }

  describe('order events', () => {
    it('should handle order.created event', async () => {
      await simulateKafkaMessage('order.created', {
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        productId: 'prod-1',
        orderId: 'order-123',
        buyerName: 'Nguyễn Văn A',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          type: 'ORDER',
          targetId: 'order-123',
        })
      );
      expect(publishNotification).toHaveBeenCalled();
      expect(sendOrderEmail).toHaveBeenCalledWith(
        'seller@example.com',
        expect.objectContaining({
          orderDetails: expect.objectContaining({
            buyer: expect.objectContaining({ name: 'Nguyễn Văn Buyer' }),
            seller: expect.objectContaining({ name: 'Trần Thị Seller' }),
            product: expect.objectContaining({ title: 'Giáo trình kỹ thuật đo điện', price: 15000 }),
          }),
        })
      );
    });

    it('should handle order.completed event', async () => {
      await simulateKafkaMessage('order.completed', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
      });

      // Should notify both buyer and seller
      expect(Notification.create).toHaveBeenCalledTimes(2);
      expect(sendOrderEmail).toHaveBeenCalledTimes(2);
      expect(sendOrderEmail).toHaveBeenCalledWith(
        'buyer@example.com',
        expect.objectContaining({
          status: 'Hoàn tất',
          orderDetails: expect.objectContaining({
            buyer: expect.objectContaining({ name: 'Nguyễn Văn Buyer' }),
            seller: expect.objectContaining({ name: 'Trần Thị Seller' }),
          }),
        })
      );
    });

    it('should handle order.cancelled event', async () => {
      await simulateKafkaMessage('order.cancelled', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
        reason: 'Không liên lạc được',
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
      expect(sendOrderEmail).toHaveBeenCalledWith(
        'seller@example.com',
        expect.objectContaining({
          status: 'Đã hủy',
          orderDetails: expect.objectContaining({
            reason: 'Không liên lạc được',
            product: expect.objectContaining({ title: 'Giáo trình kỹ thuật đo điện' }),
          }),
        })
      );
    });

    it('should notify seller when buyer reports a bank transfer without exposing ids', async () => {
      await simulateKafkaMessage('order.payment.reported', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          title: 'Người mua đã báo chuyển khoản',
          message: expect.stringContaining('Nguyễn Văn Buyer'),
          targetId: 'order-123',
        })
      );
      const message = Notification.create.mock.calls[0][0].message;
      expect(message).toContain('Giáo trình kỹ thuật đo điện');
      expect(message).not.toContain('order-123');
      expect(message).not.toContain('prod-1');
    });

    it('should notify buyer when seller confirms payment without exposing ids', async () => {
      await simulateKafkaMessage('order.payment.confirmed', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'buyer-1',
          title: 'Thanh toán thành công',
          message: expect.stringContaining('Trần Thị Seller'),
          targetId: 'order-123',
        })
      );
      const message = Notification.create.mock.calls[0][0].message;
      expect(message).toContain('Giáo trình kỹ thuật đo điện');
      expect(message).not.toContain('order-123');
      expect(message).not.toContain('seller-1');
    });

    it('should handle order.refunded event', async () => {
      await simulateKafkaMessage('order.refunded', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        amount: 500000,
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle order.dispute.opened event', async () => {
      await simulateKafkaMessage('order.dispute.opened', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        reason: 'Sản phẩm không đúng mô tả',
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle order.dispute.evidence_added event', async () => {
      await simulateKafkaMessage('order.dispute.evidence_added', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        submittedBy: 'buyer-1',
      });

      // Should notify only the other party (not the submitter)
      expect(Notification.create).toHaveBeenCalledTimes(1);
    });

    it('should handle order.handover.proposed event', async () => {
      await simulateKafkaMessage('order.handover.proposed', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        proposedBy: 'seller-1',
        location: 'Thư viện IUH',
      });

      expect(Notification.create).toHaveBeenCalledTimes(1);
    });

    it('should handle order.handover.responded event', async () => {
      await simulateKafkaMessage('order.handover.responded', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        respondedBy: 'buyer-1',
        action: 'ACCEPT',
      });

      expect(Notification.create).toHaveBeenCalledTimes(1);
    });

    it('should handle order.handover.confirmed event', async () => {
      await simulateKafkaMessage('order.handover.confirmed', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        confirmedBy: 'seller-1',
        handoverStatus: 'HANDED_OVER',
      });

      expect(Notification.create).toHaveBeenCalledTimes(1);
    });

    it('should notify the other party when payment issue is opened', async () => {
      await simulateKafkaMessage('order.payment_issue.opened', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
        openedBy: 'buyer-1',
        reason: 'Chưa thấy tiền hoàn',
      });

      expect(Notification.create).toHaveBeenCalledTimes(1);
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          title: 'Có khiếu nại thanh toán',
          message: expect.stringContaining('Giáo trình kỹ thuật đo điện'),
          targetId: 'order-123',
        })
      );
    });

    it('should notify both parties when payment issue is resolved', async () => {
      await simulateKafkaMessage('order.payment_issue.resolved', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        orderId: 'order-123',
        action: 'CONFIRM_PAID',
        status: 'RESOLVED',
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'buyer-1',
          title: 'Khiếu nại thanh toán đã xử lý',
          message: expect.stringContaining('đã xác nhận thanh toán'),
          targetId: 'order-123',
        })
      );
    });
  });

  describe('product events', () => {
    it('should handle product.reserved event', async () => {
      await simulateKafkaMessage('product.reserved', {
        sellerId: 'seller-1',
        productId: 'prod-1',
        buyerName: 'Nguyễn Văn A',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          type: 'ORDER',
        })
      );
    });

    it('should handle product.approved event', async () => {
      await simulateKafkaMessage('product.approved', {
        sellerId: 'seller-1',
        productId: 'prod-1',
        productTitle: 'iPhone 15',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          type: 'PRODUCT',
        })
      );
    });

    it('should handle product.rejected event', async () => {
      await simulateKafkaMessage('product.rejected', {
        sellerId: 'seller-1',
        productId: 'prod-1',
        productTitle: 'iPhone 15',
        reason: 'Hình ảnh không rõ',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          type: 'PRODUCT',
        })
      );
    });

    it('should handle product.reserve.expired event', async () => {
      await simulateKafkaMessage('product.reserve.expired', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-1',
        productId: 'prod-1',
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('offer events', () => {
    it('should handle offer.created event', async () => {
      await simulateKafkaMessage('offer.created', {
        sellerId: 'seller-1',
        offerId: 'offer-1',
        productId: 'prod-1',
        type: 'PRICE',
        amount: 200000,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'seller-1',
          type: 'PRODUCT',
        })
      );
    });

    it('should handle offer.resolved event', async () => {
      await simulateKafkaMessage('offer.resolved', {
        buyerId: 'buyer-1',
        offerId: 'offer-1',
        productId: 'prod-1',
        status: 'ACCEPTED',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'buyer-1',
          type: 'PRODUCT',
        })
      );
    });
  });

  describe('other events', () => {
    it('should handle karma.updated event', async () => {
      await simulateKafkaMessage('karma.updated', {
        userId: 'user-1',
        karmaChange: -10,
        reason: 'Hủy đơn hàng',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          type: 'KARMA',
        })
      );
    });

    it('should handle report.created event', async () => {
      await simulateKafkaMessage('report.created', {
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        reportId: 'report-1',
      });

      // Should notify both reporter and reported user
      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle lostfound.analyzed event', async () => {
      await simulateKafkaMessage('lostfound.analyzed', {
        userId: 'user-1',
        itemId: 'item-1',
        title: 'Ví da đen',
        detectedType: 'wallet',
        studentId: '21001234',
        confidence: 0.95,
        type: 'LOST',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          title: 'Phân tích hoàn tất',
        })
      );
    });

    it('should handle lostfound.match event', async () => {
      await simulateKafkaMessage('lostfound.match', {
        userId: 'user-1',
        itemId: 'item-1',
        title: 'Ví da đen',
        type: 'LOST',
        matches: [
          { itemId: 'item-2', title: 'Ví da nâu', score: 0.85, ownerId: 'user-2' },
        ],
      });

      // Should notify item owner + match owner
      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle lostfound.match with no matches', async () => {
      await simulateKafkaMessage('lostfound.match', {
        userId: 'user-1',
        itemId: 'item-1',
        title: 'Ví da đen',
        type: 'LOST',
        matches: [],
      });

      // No notification if no matches
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('should handle user.student_verification.requested event', async () => {
      await simulateKafkaMessage('user.student_verification.requested', {
        userId: 'user-1',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          title: 'Đã gửi xác minh MSSV',
        })
      );
    });

    it('should handle user.student_verification.reviewed event', async () => {
      await simulateKafkaMessage('user.student_verification.reviewed', {
        userId: 'user-1',
        status: 'VERIFIED',
        adminNote: 'Đã xác minh',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          title: 'MSSV đã được xác minh',
        })
      );
    });

    it('should handle lostfound.claim.created event', async () => {
      await simulateKafkaMessage('lostfound.claim.created', {
        ownerId: 'user-1',
        itemId: 'item-1',
        title: 'Ví da đen',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          title: 'Có yêu cầu nhận đồ thất lạc',
        })
      );
    });

    it('should handle lostfound.claim.resolved event', async () => {
      await simulateKafkaMessage('lostfound.claim.resolved', {
        claimantId: 'user-1',
        itemId: 'item-1',
        title: 'Ví da đen',
        status: 'APPROVED',
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          title: 'Claim đã được duyệt',
        })
      );
    });
  });

  describe('sendNotification behavior', () => {
    it('should respect notification preferences', async () => {
      NotificationPreference.findOne.mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          inApp: { ORDER: false },
          push: { ORDER: false },
          email: { ORDER: false },
        }),
      });

      await simulateKafkaMessage('order.created', {
        sellerId: 'seller-1',
        orderId: 'order-123',
      });

      // Notification record still created
      expect(Notification.create).toHaveBeenCalled();
      // But in-app publish skipped
      expect(publishNotification).not.toHaveBeenCalled();
      // And FCM push skipped
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('should skip if recipientId is missing', async () => {
      await simulateKafkaMessage('order.created', {
        orderId: 'order-123',
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should save to DLQ on handler error', async () => {
      Notification.create.mockRejectedValueOnce(new Error('DB error'));

      await simulateKafkaMessage('order.created', {
        sellerId: 'seller-1',
        orderId: 'order-123',
      });

      expect(DlqEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'order.created',
          error: 'DB error',
          status: 'PENDING',
        })
      );
    });

    it('should handle missing message value gracefully', async () => {
      const message = { value: null, offset: '0' };

      await expect(
        eachMessage({ topic: 'order.created', partition: 0, message })
      ).resolves.not.toThrow();
    });
  });
});
