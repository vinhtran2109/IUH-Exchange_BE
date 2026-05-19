import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
vi.mock('../models/Review.js', () => {
  const mockReview = {
    _id: 'review-1',
    productId: 'prod-1',
    orderId: 'order-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    rating: 5,
    comment: 'Sản phẩm tốt',
    createdAt: new Date(),
  };

  return {
    Review: {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([mockReview]),
        }),
        lean: vi.fn().mockResolvedValue([mockReview]),
      }),
      findOne: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
      countDocuments: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mockReview),
      aggregate: vi.fn().mockResolvedValue([{ _id: null, avgRating: 4.5, totalReviews: 10 }]),
    },
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
    config: { jwt: { secret: 'test' }, gatewaySecret: '' },
  };
});

import { getProductReviews, checkReviewExists, getSellerReviews } from '../controllers/review.controller.js';
import { Review } from '../models/Review.js';

describe('review.controller', () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: {},
      query: {},
      user: { sub: 'buyer-1' },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe('getProductReviews', () => {
    it('should return paginated reviews for a product', async () => {
      req.params.productId = 'prod-1';
      req.query = { page: '1', size: '10' };

      await getProductReviews(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            content: expect.any(Array),
            avgRating: expect.any(Number),
            totalReviews: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('checkReviewExists', () => {
    it('should return exists=false when no review found', async () => {
      req.params.productId = 'prod-1';
      req.query.orderId = 'order-1';

      await checkReviewExists(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ exists: false }),
        })
      );
    });

    it('should throw if orderId is missing', async () => {
      req.params.productId = 'prod-1';
      req.query = {};

      await expect(checkReviewExists(req, res)).rejects.toThrow('orderId is required');
    });
  });

  describe('getSellerReviews', () => {
    it('should return paginated reviews for a seller', async () => {
      req.params.userId = 'seller-1';
      req.query = { page: '1', size: '10' };

      await getSellerReviews(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            content: expect.any(Array),
            avgRating: expect.any(Number),
          }),
        })
      );
    });
  });
});
