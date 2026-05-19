import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
vi.mock('../models/Wishlist.js', () => {
  const mockFindOneResult = {
    lean: vi.fn().mockResolvedValue(null),
  };
  const mockFindOne = vi.fn().mockReturnValue(mockFindOneResult);

  return {
    Wishlist: {
      findOne: mockFindOne,
      deleteOne: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue({ userId: 'user-1', productId: 'prod-1' }),
      countDocuments: vi.fn().mockResolvedValue(0),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    __mockFindOne: mockFindOne,
    __mockFindOneResult: mockFindOneResult,
  };
});

vi.mock('../models/Product.js', () => ({
  Product: {
    findById: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'prod-1',
        sellerId: 'seller-1',
        title: 'iPhone 15',
      }),
    }),
  },
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

import { toggleWishlist, checkWishlist } from '../controllers/wishlist.controller.js';
import { Wishlist, __mockFindOne as mockFindOne, __mockFindOneResult as mockFindOneResult } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';

describe('wishlist.controller', () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOne.mockReturnValue(mockFindOneResult);
    mockFindOneResult.lean.mockResolvedValue(null);
    req = {
      params: {},
      query: {},
      user: { sub: 'user-1' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe('toggleWishlist', () => {
    it('should add to wishlist when not exists', async () => {
      req.params.productId = 'prod-1';
      mockFindOne.mockReturnValueOnce(null);

      await toggleWishlist(req, res);

      expect(Wishlist.create).toHaveBeenCalledWith({ userId: 'user-1', productId: 'prod-1' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { wishlisted: true },
        })
      );
    });

    it('should remove from wishlist when exists', async () => {
      req.params.productId = 'prod-1';
      mockFindOne.mockReturnValueOnce({ _id: 'wish-1', userId: 'user-1', productId: 'prod-1' });

      await toggleWishlist(req, res);

      expect(Wishlist.deleteOne).toHaveBeenCalledWith({ _id: 'wish-1' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { wishlisted: false },
        })
      );
    });

    it('should throw if product not found', async () => {
      req.params.productId = 'nonexistent';
      Product.findById.mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(toggleWishlist(req, res)).rejects.toThrow();
    });
  });

  describe('checkWishlist', () => {
    it('should return wishlisted=false when not in wishlist', async () => {
      req.params.productId = 'prod-1';

      await checkWishlist(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { wishlisted: false },
        })
      );
    });

    it('should return wishlisted=true when in wishlist', async () => {
      req.params.productId = 'prod-1';
      mockFindOneResult.lean.mockResolvedValueOnce({ _id: 'wish-1' });

      await checkWishlist(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { wishlisted: true },
        })
      );
    });
  });
});
