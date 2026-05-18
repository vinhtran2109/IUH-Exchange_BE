import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ElasticSearch client ──
vi.mock('@elastic/elasticsearch', () => {
  const mockSearch = vi.fn();
  const mockIndex = vi.fn();
  const mockDelete = vi.fn();
  const mockIndicesExists = vi.fn();
  const mockIndicesCreate = vi.fn();
  const mockPutMapping = vi.fn();

  function MockClient() {
    this.search = mockSearch;
    this.index = mockIndex;
    this.delete = mockDelete;
    this.indices = {
      exists: mockIndicesExists,
      create: mockIndicesCreate,
      putMapping: mockPutMapping,
    };
    return this;
  }

  return {
    Client: MockClient,
    __mockSearch: mockSearch,
    __mockIndex: mockIndex,
    __mockDelete: mockDelete,
    __mockIndicesExists: mockIndicesExists,
    __mockIndicesCreate: mockIndicesCreate,
    __mockPutMapping: mockPutMapping,
  };
});

vi.mock('@iuh-exchange/common', () => ({
  config: { elasticsearch: { node: 'http://localhost:9200' } },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ensureIndex,
  indexProduct,
  removeProduct,
  searchProducts,
  suggestProducts,
} from '../services/elasticsearch.service.js';
import {
  __mockSearch as mockSearch,
  __mockIndex as mockIndex,
  __mockDelete as mockDelete,
  __mockIndicesExists as mockIndicesExists,
  __mockIndicesCreate as mockIndicesCreate,
  __mockPutMapping as mockPutMapping,
} from '@elastic/elasticsearch';

describe('elasticsearch.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureIndex', () => {
    it('should create index if it does not exist', async () => {
      mockIndicesExists.mockResolvedValue(false);
      mockIndicesCreate.mockResolvedValue({ acknowledged: true });

      await ensureIndex();

      expect(mockIndicesCreate).toHaveBeenCalled();
    });

    it('should not create index if it already exists', async () => {
      mockIndicesExists.mockResolvedValue(true);
      mockPutMapping.mockResolvedValue({ acknowledged: true });

      await ensureIndex();

      expect(mockIndicesCreate).not.toHaveBeenCalled();
      expect(mockPutMapping).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockIndicesExists.mockRejectedValue(new Error('ES down'));

      await expect(ensureIndex()).resolves.not.toThrow();
    });
  });

  describe('indexProduct', () => {
    it('should index a product document', async () => {
      mockIndex.mockResolvedValue({ result: 'created' });

      await indexProduct({
        id: 'prod-1',
        title: 'iPhone 15',
        description: 'Điện thoại iPhone 15 mới',
        price: 15000000,
        category: 'ELECTRONICS',
        location: 'IUH',
        condition: 'NEW',
        status: 'AVAILABLE',
      });

      expect(mockIndex).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod-1',
        document: expect.objectContaining({
          title: 'iPhone 15',
          price: 15000000,
          category: 'ELECTRONICS',
        }),
      });
    });

    it('should handle indexing errors gracefully', async () => {
      mockIndex.mockRejectedValue(new Error('Index failed'));

      await expect(
        indexProduct({ id: 'prod-1', title: 'Test' })
      ).resolves.not.toThrow();
    });
  });

  describe('removeProduct', () => {
    it('should remove a product from index', async () => {
      mockDelete.mockResolvedValue({ result: 'deleted' });

      await removeProduct('prod-1');

      expect(mockDelete).toHaveBeenCalledWith(
        { index: 'products', id: 'prod-1' },
        { ignore: [404] }
      );
    });
  });

  describe('searchProducts', () => {
    it('should search with fuzzy keyword matching', async () => {
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'prod-1',
              _source: {
                title: 'iPhone 15 Pro',
                price: 15000000,
                category: 'ELECTRONICS',
              },
            },
          ],
        },
      });

      const result = await searchProducts('iphone', 1, 20);

      expect(result.hits).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hits[0].id).toBe('prod-1');
    });

    it('should apply price range filter', async () => {
      mockSearch.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await searchProducts('laptop', 1, 20, {
        minPrice: 5000000,
        maxPrice: 20000000,
      });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                expect.objectContaining({
                  range: {
                    price: { gte: 5000000, lte: 20000000 },
                  },
                }),
              ]),
            }),
          }),
        })
      );
    });

    it('should apply category filter', async () => {
      mockSearch.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await searchProducts('test', 1, 20, { category: 'ELECTRONICS' });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { term: { category: 'ELECTRONICS' } },
              ]),
            }),
          }),
        })
      );
    });

    it('should apply sort options', async () => {
      mockSearch.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await searchProducts('test', 1, 20, { sort: 'price_asc' });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ price: 'asc' }, '_score'],
        })
      );
    });

    it('should use match_all when no keyword provided', async () => {
      mockSearch.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await searchProducts('', 1, 20);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: [{ match_all: {} }],
            }),
          }),
        })
      );
    });

    it('should return empty results on search error', async () => {
      mockSearch.mockRejectedValue(new Error('ES down'));

      const result = await searchProducts('test');

      expect(result.hits).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('suggestProducts', () => {
    it('should return suggestions for valid keyword', async () => {
      mockSearch.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'prod-1',
              _source: { title: 'iPhone 15', category: 'ELECTRONICS', location: 'IUH' },
            },
          ],
        },
      });

      const results = await suggestProducts('iphone', 5);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('iPhone 15');
    });

    it('should return empty for short keyword', async () => {
      const results = await suggestProducts('a');
      expect(results).toEqual([]);
    });

    it('should return empty on error', async () => {
      mockSearch.mockRejectedValue(new Error('ES error'));

      const results = await suggestProducts('test');
      expect(results).toEqual([]);
    });
  });
});
