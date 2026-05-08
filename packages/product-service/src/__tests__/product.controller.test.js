import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockProduct = {
  _id: 'prod123',
  sellerId: 'user123',
  title: 'Sách Toán Rời Rạc',
  description: 'Sách còn mới 90%',
  price: 50000,
  imageUrls: [],
  category: 'Sách',
  condition: 'GOOD',
  status: 'AVAILABLE',
  createdAt: new Date(),
  updatedAt: new Date(),
  toObject: vi.fn().mockReturnThis(),
  save: vi.fn(),
  lean: vi.fn().mockReturnThis(),
};

const mockProductModel = {
  find: vi.fn().mockReturnThis(),
  findById: vi.fn(),
  findOne: vi.fn(),
  findByIdAndDelete: vi.fn(),
  countDocuments: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  create: vi.fn(),
};

vi.mock('../models/Product.js', () => ({
  Product: mockProductModel,
}));

vi.mock('../services/elasticsearch.service.js', () => ({
  searchProducts: vi.fn().mockResolvedValue({ hits: [], total: 0 }),
}));

vi.mock('../services/kafka.service.js', () => ({
  publishProductEvent: vi.fn().mockResolvedValue(true),
  TOPICS: {
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',
  },
}));

vi.mock('../services/s3.service.js', () => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue({
    presignedUrl: 'https://s3.amazonaws.com/upload',
    publicUrl: 'https://s3.amazonaws.com/image.jpg',
  }),
  deleteFileByUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/profanity-filter.js', () => ({
  containsProfanity: vi.fn().mockReturnValue(false),
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
      delPattern: vi.fn().mockResolvedValue(true),
    },
  };
});

const productController = await import('../controllers/product.controller.js');
const { containsProfanity } = await import('../services/profanity-filter.js');

function mockReqRes(body = {}, params = {}, query = {}, user = { sub: 'user123' }) {
  const req = { body, params, query, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('product.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    mockProductModel.find.mockReturnThis();
    mockProductModel.sort.mockReturnThis();
    mockProductModel.skip.mockReturnThis();
    mockProductModel.limit.mockReturnThis();
    mockProductModel.lean.mockReturnThis();
    // Re-set profanity filter default (clearAllMocks resets it)
    containsProfanity.mockReturnValue(false);
  });

  describe('listProducts', () => {
    it('should return paginated products', async () => {
      const products = [{ ...mockProduct }];
      mockProductModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(products),
            }),
          }),
        }),
      });
      mockProductModel.countDocuments.mockResolvedValue(1);

      const { req, res } = mockReqRes({}, {}, { page: '1', size: '20' });
      await productController.listProducts(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
    });
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      containsProfanity.mockReturnValue(false);
      mockProductModel.create.mockResolvedValue({
        ...mockProduct,
        toObject: () => ({ ...mockProduct }),
      });

      const { req, res } = mockReqRes({
        title: 'Sách Toán',
        description: 'Sách mới 90%',
        price: 50000,
        category: 'Sách',
        condition: 'GOOD',
        imageUrls: [],
      });
      await productController.createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockProductModel.create).toHaveBeenCalled();
    });

    it('should reject product with profanity', async () => {
      containsProfanity.mockReturnValue(true);

      const { req, res } = mockReqRes({
        title: 'Bad word title',
        description: 'Description',
        price: 100,
        category: 'Test',
        condition: 'GOOD',
      });

      await expect(productController.createProduct(req, res)).rejects.toThrow('từ ngữ không phù hợp');
    });
  });

  describe('getProductById', () => {
    it('should return a product by ID', async () => {
      const product = { ...mockProduct, toObject: () => ({ ...mockProduct }) };
      // Mock the chain: findById(...).lean()
      mockProductModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(product),
      });

      const { req, res } = mockReqRes({}, { id: 'prod123' });
      await productController.getProductById(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should throw 404 for missing product', async () => {
      mockProductModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const { req, res } = mockReqRes({}, { id: 'nonexistent' });
      await expect(productController.getProductById(req, res)).rejects.toThrow();
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const product = {
        ...mockProduct,
        sellerId: 'user123',
        save: vi.fn().mockResolvedValue({ ...mockProduct, title: 'Updated' }),
      };
      mockProductModel.findById.mockResolvedValue(product);

      const { req, res } = mockReqRes(
        { title: 'Updated Title' },
        { id: 'prod123' },
        {},
        { sub: 'user123' }
      );
      await productController.updateProduct(req, res);

      expect(product.save).toHaveBeenCalled();
    });

    it('should reject update from non-owner', async () => {
      const product = { ...mockProduct, sellerId: 'owner123' };
      mockProductModel.findById.mockResolvedValue(product);

      const { req, res } = mockReqRes(
        { title: 'Hack' },
        { id: 'prod123' },
        {},
        { sub: 'other-user' }
      );
      await expect(productController.updateProduct(req, res)).rejects.toThrow("permission");
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const product = {
        ...mockProduct,
        sellerId: 'user123',
        imageUrls: ['https://s3.amazonaws.com/img1.jpg'],
      };
      mockProductModel.findById.mockResolvedValue(product);
      mockProductModel.findByIdAndDelete.mockResolvedValue(true);

      const { req, res } = mockReqRes({}, { id: 'prod123' }, {}, { sub: 'user123' });
      await productController.deleteProduct(req, res);

      expect(mockProductModel.findByIdAndDelete).toHaveBeenCalledWith('prod123');
    });

    it('should reject delete from non-owner', async () => {
      mockProductModel.findById.mockResolvedValue({ ...mockProduct, sellerId: 'owner123' });

      const { req, res } = mockReqRes({}, { id: 'prod123' }, {}, { sub: 'other-user' });
      await expect(productController.deleteProduct(req, res)).rejects.toThrow("permission");
    });
  });

  describe('searchProductsHandler', () => {
    it('should search products via ElasticSearch', async () => {
      const { searchProducts } = await import('../services/elasticsearch.service.js');
      searchProducts.mockResolvedValue({
        hits: [{ id: 'prod1', title: 'Sách', price: 50000 }],
        total: 1,
      });

      const { req, res } = mockReqRes({}, {}, { keyword: 'sách', page: '1', size: '20' });
      await productController.searchProductsHandler(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.content).toHaveLength(1);
    });
  });

  describe('getUploadUrl', () => {
    it('should generate presigned URL', async () => {
      const { req, res } = mockReqRes({ filename: 'photo.jpg', contentType: 'image/jpeg' });
      await productController.getUploadUrl(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.presignedUrl).toBeDefined();
      expect(response.data.publicUrl).toBeDefined();
    });
  });
});
