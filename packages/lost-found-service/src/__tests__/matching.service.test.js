import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ──
vi.mock('../models/LostFound.js', () => {
  const mockItems = [];
  return {
    LostFoundItem: {
      findById: vi.fn((id) => {
        const item = mockItems.find((i) => i._id === id);
        return Promise.resolve(item || null);
      }),
      find: vi.fn((filter) => {
        let results = [...mockItems];
        if (filter?.type) results = results.filter((i) => i.type === filter.type);
        if (filter?.status) results = results.filter((i) => i.status === filter.status);
        if (filter?._id?.$ne) results = results.filter((i) => i._id !== filter._id.$ne);
        if (filter?.$or) {
          results = results.filter((i) =>
            filter.$or.some((cond) => cond.category === i.category)
          );
        }
        return {
          sort: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(results),
        };
      }),
    },
    __setMockItems: (items) => {
      mockItems.length = 0;
      mockItems.push(...items);
    },
  };
});

vi.mock('@iuh-exchange/common', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { findMatches, autoMatchOnCreate } from '../services/matching.service.js';
import { LostFoundItem } from '../models/LostFound.js';

describe('matching.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMatches', () => {
    it('should find matching items of opposite type', async () => {
      const sourceItem = {
        _id: 'item-1',
        type: 'LOST',
        title: 'Ví da màu nâu',
        description: 'Ví da màu nâu có chứa CMND',
        category: 'ACCESSORIES',
        tags: ['ví', 'da'],
        location: 'Thư viện',
        status: 'OPEN',
      };

      const candidateItem = {
        _id: 'item-2',
        type: 'FOUND',
        title: 'Ví da nâu nhặt được',
        description: 'Ví da màu nâu tại thư viện',
        category: 'ACCESSORIES',
        tags: ['ví', 'da', 'nâu'],
        location: 'Thư viện trường',
        status: 'OPEN',
      };

      LostFoundItem.findById.mockResolvedValue(sourceItem);
      LostFoundItem.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([candidateItem]),
      });

      const matches = await findMatches('item-1', { limit: 5, minScore: 0.1 });

      expect(matches).toBeInstanceOf(Array);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].item._id).toBe('item-2');
      expect(matches[0].score).toBeGreaterThan(0);
    });

    it('should return empty array when no candidates found', async () => {
      const sourceItem = {
        _id: 'item-1',
        type: 'LOST',
        title: 'Laptop MacBook Pro',
        description: 'MacBook Pro 14 inch',
        category: 'ELECTRONICS',
        tags: ['laptop', 'macbook'],
        status: 'OPEN',
      };

      LostFoundItem.findById.mockResolvedValue(sourceItem);
      LostFoundItem.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const matches = await findMatches('item-1');
      expect(matches).toEqual([]);
    });

    it('should throw error for non-existent item', async () => {
      LostFoundItem.findById.mockResolvedValue(null);

      await expect(findMatches('nonexistent')).rejects.toThrow('Item not found: nonexistent');
    });

    it('should match FOUND item to LOST items', async () => {
      const sourceItem = {
        _id: 'item-10',
        type: 'FOUND',
        title: 'Chìa khóa xe máy',
        description: 'Chìa khóa Honda có móc khóa hình gấu',
        category: 'KEYS',
        tags: ['chìa khóa', 'xe máy'],
        location: 'Căng tin',
        status: 'OPEN',
      };

      const candidateItem = {
        _id: 'item-11',
        type: 'LOST',
        title: 'Mất chìa khóa xe máy',
        description: 'Chìa khóa Honda có móc khóa gấu bông',
        category: 'KEYS',
        tags: ['chìa khóa', 'honda'],
        location: 'Căng tin tầng 2',
        status: 'OPEN',
      };

      LostFoundItem.findById.mockResolvedValue(sourceItem);
      LostFoundItem.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([candidateItem]),
      });

      const matches = await findMatches('item-10', { minScore: 0.1 });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].item.type).toBe('LOST');
    });

    it('should score higher for items with more similarity', async () => {
      const sourceItem = {
        _id: 'item-20',
        type: 'LOST',
        title: 'iPhone 15 Pro Max',
        description: 'iPhone 15 Pro Max 256GB màu titan tự nhiên',
        category: 'ELECTRONICS',
        tags: ['iphone', 'apple', 'điện thoại'],
        location: 'Phòng A305',
        status: 'OPEN',
      };

      const highMatchCandidate = {
        _id: 'item-21',
        type: 'FOUND',
        title: 'iPhone 15 Pro Max tìm thấy',
        description: 'iPhone 15 Pro Max 256GB titan tự nhiên tại phòng A305',
        category: 'ELECTRONICS',
        tags: ['iphone', 'apple', 'điện thoại'],
        location: 'Phòng A305',
        status: 'OPEN',
      };

      const lowMatchCandidate = {
        _id: 'item-22',
        type: 'FOUND',
        title: 'Điện thoại Samsung Galaxy',
        description: 'Samsung Galaxy S24 Ultra',
        category: 'ELECTRONICS',
        tags: ['samsung', 'galaxy'],
        location: 'Sân trường',
        status: 'OPEN',
      };

      LostFoundItem.findById.mockResolvedValue(sourceItem);
      LostFoundItem.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([highMatchCandidate, lowMatchCandidate]),
      });

      const matches = await findMatches('item-20', { minScore: 0.1 });
      expect(matches.length).toBe(2);
      // High match should be first (sorted by score desc)
      expect(matches[0].item._id).toBe('item-21');
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });
  });

  describe('autoMatchOnCreate', () => {
    it('should return matches for a new item', async () => {
      const newItem = {
        _id: 'item-new',
        type: 'FOUND',
        title: 'Ví nữ hồng',
        category: 'ACCESSORIES',
        status: 'OPEN',
      };

      const lostItem = {
        _id: 'item-lost',
        type: 'LOST',
        title: 'Ví nữ màu hồng',
        category: 'ACCESSORIES',
        status: 'OPEN',
      };

      LostFoundItem.findById.mockResolvedValue(newItem);
      LostFoundItem.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([lostItem]),
      });

      const matches = await autoMatchOnCreate(newItem);
      expect(matches).toBeInstanceOf(Array);
    });

    it('should return empty array on error', async () => {
      LostFoundItem.findById.mockRejectedValue(new Error('DB error'));

      const matches = await autoMatchOnCreate({ _id: 'bad-item' });
      expect(matches).toEqual([]);
    });
  });
});
