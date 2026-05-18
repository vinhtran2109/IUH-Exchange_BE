import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock common module ──
vi.mock('@iuh-exchange/common', () => {
  const mockSend = vi.fn().mockResolvedValue(true);
  const mockProducer = { send: mockSend };
  return {
    createProducer: vi.fn().mockResolvedValue(mockProducer),
    createConsumer: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue(true),
    }),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    __mockProducer: mockProducer,
    __mockSend: mockSend,
  };
});

import {
  initProducer,
  publishOrderCreated,
  publishOrderCancelled,
  publishOrderCompleted,
  publishOrderDisputeOpened,
  publishOrderRefunded,
  publishOrderEvent,
  startSagaConsumer,
} from '../services/saga.service.js';
import { __mockSend as mockSend } from '@iuh-exchange/common';

describe('order saga.service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(true);
    await initProducer();
  });

  describe('initProducer', () => {
    it('should initialize Kafka producer', async () => {
      const { createProducer } = await import('@iuh-exchange/common');
      expect(createProducer).toHaveBeenCalledWith('order-service');
    });
  });

  describe('publishOrderCreated', () => {
    it('should publish order.created event', async () => {
      const event = {
        orderId: 'order-1',
        productId: 'prod-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        price: 100000,
      };

      await publishOrderCreated(event);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'order.created',
        messages: [
          {
            key: 'order-1',
            value: JSON.stringify(event),
          },
        ],
      });
    });

    it('should not throw when Kafka is unavailable', async () => {
      mockSend.mockRejectedValue(new Error('Kafka down'));

      await expect(
        publishOrderCreated({ orderId: 'order-1' })
      ).resolves.not.toThrow();
    });
  });

  describe('publishOrderCancelled', () => {
    it('should publish order.cancelled event', async () => {
      const event = {
        orderId: 'order-1',
        productId: 'prod-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        reason: 'Buyer cancelled',
      };

      await publishOrderCancelled(event);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'order.cancelled',
        messages: [
          {
            key: 'order-1',
            value: JSON.stringify(event),
          },
        ],
      });
    });
  });

  describe('publishOrderCompleted', () => {
    it('should publish order.completed event', async () => {
      const event = {
        orderId: 'order-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
      };

      await publishOrderCompleted(event);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'order.completed',
        messages: [
          {
            key: 'order-1',
            value: JSON.stringify(event),
          },
        ],
      });
    });
  });

  describe('publishOrderDisputeOpened', () => {
    it('should publish order.dispute.opened event', async () => {
      const event = {
        orderId: 'order-1',
        productId: 'prod-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        openedBy: 'buyer-1',
        reason: 'Item not as described',
      };

      await publishOrderDisputeOpened(event);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'order.dispute.opened',
        messages: [
          {
            key: 'order-1',
            value: JSON.stringify(event),
          },
        ],
      });
    });
  });

  describe('publishOrderRefunded', () => {
    it('should publish order.refunded event', async () => {
      const event = {
        orderId: 'order-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 100000,
      };

      await publishOrderRefunded(event);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'order.refunded',
        messages: [
          {
            key: 'order-1',
            value: JSON.stringify(event),
          },
        ],
      });
    });
  });

  describe('publishOrderEvent', () => {
    it('should publish event to specified topic', async () => {
      await publishOrderEvent('custom.topic', { orderId: 'order-1', data: 'test' });

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'custom.topic',
        messages: [
          {
            key: 'order-1',
            value: expect.stringContaining('"data":"test"'),
          },
        ],
      });
    });
  });

  describe('startSagaConsumer', () => {
    it('should start consumer and register handlers', async () => {
      const mockOrderService = {
        markAwaitingSellerConfirmation: vi.fn(),
        cancelOrder: vi.fn(),
      };

      await startSagaConsumer(mockOrderService);

      const { createConsumer } = await import('@iuh-exchange/common');
      expect(createConsumer).toHaveBeenCalledWith(
        'order-service-group',
        expect.arrayContaining([
          { topic: 'product.reserved' },
          { topic: 'product.reserve.failed' },
          { topic: 'product.reserve.expired' },
        ]),
        'order-service-consumer'
      );
    });
  });
});
