import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

process.env.IMAGE_ANALYSIS_PROVIDER = 'mock';

// ── Mock dependencies ──
vi.mock('../models/LostFound.js', () => {
  const mockSave = vi.fn().mockResolvedValue(true);
  const mockItem = {
    _id: 'test-item-id',
    userId: 'user-1',
    type: 'FOUND',
    title: 'Test Item',
    images: ['https://example.com/wallet.jpg'],
    category: 'OTHER',
    tags: [],
    analysisStatus: 'PENDING',
    detectedType: '',
    analysisConfidence: 0,
    extracted: { studentId: '', text: '' },
    analysisMetadata: {},
    save: mockSave,
  };

  return {
    LostFoundItem: {
      findById: vi.fn().mockResolvedValue(mockItem),
      __mockItem: mockItem,
      __mockSave: mockSave,
    },
  };
});

vi.mock('../services/kafka.service.js', () => ({
  publishLostFoundAnalyzed: vi.fn().mockResolvedValue(true),
  publishLostFoundMatch: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/matching.service.js', () => ({
  findMatches: vi.fn().mockResolvedValue([]),
}));

vi.mock('@iuh-exchange/common', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  cache: {
    del: vi.fn().mockResolvedValue(true),
  },
  withRetry: vi.fn(async (fn) => fn()),
}));

import { LostFoundItem } from '../models/LostFound.js';
import { publishLostFoundAnalyzed, publishLostFoundMatch } from '../services/kafka.service.js';
import { findMatches } from '../services/matching.service.js';

let analyzeItem;
let queueAnalysis;

describe('image-processor.service', () => {
  beforeAll(async () => {
    const module = await import('../services/image-processor.service.js');
    analyzeItem = module.analyzeItem;
    queueAnalysis = module.queueAnalysis;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock item state
    const mockItem = LostFoundItem.__mockItem;
    mockItem.analysisStatus = 'PENDING';
    mockItem.category = 'OTHER';
    mockItem.tags = [];
    mockItem.detectedType = '';
    mockItem.images = ['https://example.com/wallet.jpg'];
  });

  describe('analyzeItem', () => {
    it('should analyze an item with mock provider and detect wallet', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da đen';
      mockItem.description = 'Ví da màu đen, rơi ở thư viện';

      const result = await analyzeItem('test-item-id');

      expect(result.status).toBe('completed');
      expect(result.detectedType).toBe('wallet');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(mockItem.analysisStatus).toBe('COMPLETED');
      expect(mockItem.save).toHaveBeenCalled();
    });

    it('should detect phone from title', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/phone.jpg'];
      mockItem.title = 'Điện thoại iPhone 15';
      mockItem.description = 'Điện thoại iPhone 15 Pro Max, màu titan tự nhiên';

      const result = await analyzeItem('test-item-id');

      expect(result.detectedType).toBe('phone');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect keys from title', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/keys.jpg'];
      mockItem.title = 'Chìa khóa xe máy';
      mockItem.description = 'Chìa khóa xe Airblade, có móc khóa hình gấu';

      const result = await analyzeItem('test-item-id');

      expect(result.detectedType).toBe('keys');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should detect student card and extract MSSV', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/card-student-id.jpg'];
      mockItem.title = 'Thẻ sinh viên IUH';
      mockItem.description = 'Thẻ sinh viên MSSV 2100001234';

      const result = await analyzeItem('test-item-id');

      expect(result.detectedType).toBe('student_card');
      expect(result.studentId).toBe('2100001234');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should skip already analyzed items', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.analysisStatus = 'COMPLETED';

      const result = await analyzeItem('test-item-id');

      expect(result.status).toBe('skipped');
      expect(mockItem.save).not.toHaveBeenCalled();
    });

    it('should re-analyze if force option is true', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.analysisStatus = 'COMPLETED';
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da nâu';

      const result = await analyzeItem('test-item-id', { force: true });

      expect(result.status).toBe('completed');
      expect(mockItem.save).toHaveBeenCalled();
    });

    it('should skip items with no images', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = [];

      const result = await analyzeItem('test-item-id');

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('no_images');
      expect(mockItem.analysisStatus).toBe('SKIPPED');
    });

    it('should throw error for non-existent item', async () => {
      LostFoundItem.findById.mockResolvedValueOnce(null);

      await expect(analyzeItem('nonexistent')).rejects.toThrow('Item không tồn tại: nonexistent');
    });

    it('should publish Kafka event after successful analysis', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da đen';

      await analyzeItem('test-item-id');

      expect(publishLostFoundAnalyzed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'test-item-id',
          userId: 'user-1',
          type: 'FOUND',
          detectedType: 'wallet',
        })
      );
    });

    it('should run post-analysis matching', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da đen';

      await analyzeItem('test-item-id');

      expect(findMatches).toHaveBeenCalledWith('test-item-id', { limit: 5, minScore: 0.5 });
    });

    it('should publish match event when matches found', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da đen';

      findMatches.mockResolvedValueOnce([
        { item: { _id: 'match-1', title: 'Ví mất', userId: 'user-2' }, score: 0.8 },
      ]);

      await analyzeItem('test-item-id');

      expect(publishLostFoundMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'test-item-id',
          matches: expect.arrayContaining([
            expect.objectContaining({ itemId: 'match-1', score: 0.8 }),
          ]),
        })
      );
    });

    it('should auto-categorize item based on detected type', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.category = 'OTHER';
      mockItem.images = ['https://example.com/wallet.jpg'];
      mockItem.title = 'Ví da đen';

      await analyzeItem('test-item-id');

      expect(mockItem.category).toBe('ACCESSORIES');
    });

    it('should auto-suggest tags if empty', async () => {
      const mockItem = LostFoundItem.__mockItem;
      mockItem.tags = [];
      mockItem.images = ['https://example.com/phone.jpg'];
      mockItem.title = 'Điện thoại Samsung Galaxy';

      await analyzeItem('test-item-id');

      expect(mockItem.tags).toContain('phone');
    });
  });

  describe('queueAnalysis', () => {
    it('should queue analysis without throwing', () => {
      expect(() => queueAnalysis('test-item-id')).not.toThrow();
    });
  });
});
