import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock common module ──
vi.mock('@iuh-exchange/common', () => {
  const mockSend = vi.fn().mockResolvedValue(true);
  const mockProducer = { send: mockSend };
  return {
    createProducer: vi.fn().mockResolvedValue(mockProducer),
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
  initKafka,
  publishLostFoundAnalyzed,
  publishLostFoundMatch,
  publishKarmaPenalty,
  publishLostFoundEvent,
} from '../services/kafka.service.js';
import { __mockSend as mockSend, __mockProducer as mockProducer } from '@iuh-exchange/common';

describe('lost-found kafka.service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(true);
    await initKafka();
  });

  describe('initKafka', () => {
    it('should initialize Kafka producer', async () => {
      const { createProducer } = await import('@iuh-exchange/common');
      expect(createProducer).toHaveBeenCalledWith('lost-found-service');
    });
  });

  describe('publishLostFoundAnalyzed', () => {
    it('should publish analyzed event to kafka', async () => {
      const payload = {
        itemId: 'item-1',
        userId: 'user-1',
        type: 'FOUND',
        title: 'Ví da',
        detectedType: 'wallet',
        studentId: '',
        confidence: 0.85,
        category: 'ACCESSORIES',
      };

      await publishLostFoundAnalyzed(payload);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'lostfound.analyzed',
        messages: [
          {
            key: 'item-1',
            value: expect.stringContaining('"itemId":"item-1"'),
          },
        ],
      });
    });
  });

  describe('publishLostFoundMatch', () => {
    it('should publish match event to kafka', async () => {
      const payload = {
        itemId: 'item-1',
        userId: 'user-1',
        type: 'LOST',
        title: 'Ví mất',
        matches: [
          { itemId: 'item-2', title: 'Ví nhặt được', score: 0.8, ownerId: 'user-2' },
        ],
      };

      await publishLostFoundMatch(payload);

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'lostfound.match',
        messages: [
          {
            key: 'item-1',
            value: expect.stringContaining('"matches"'),
          },
        ],
      });
    });
  });

  describe('publishKarmaPenalty', () => {
    it('should publish karma penalty event', async () => {
      await publishKarmaPenalty('user-1', 'Fake item report');

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'user.karma.penalty',
        messages: [
          {
            key: 'user-1',
            value: expect.stringContaining('"pointsToDeduct":5'),
          },
        ],
      });
    });
  });

  describe('publishLostFoundEvent', () => {
    it('should publish generic event to specified topic', async () => {
      await publishLostFoundEvent('custom.topic', { id: '123', data: 'test' });

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'custom.topic',
        messages: [
          {
            key: '123',
            value: expect.stringContaining('"data":"test"'),
          },
        ],
      });
    });
  });
});
