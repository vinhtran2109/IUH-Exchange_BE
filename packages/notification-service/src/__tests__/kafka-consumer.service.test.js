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
    });

    it('should handle order.completed event', async () => {
      await simulateKafkaMessage('order.completed', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
      });

      // Should notify both buyer and seller
      expect(Notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle order.cancelled event', async () => {
      await simulateKafkaMessage('order.cancelled', {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        orderId: 'order-123',
        reason: 'Không liên lạc được',
      });

      expect(Notification.create).toHaveBeenCalledTimes(2);
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
