import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock('../utils/redis.js', () => ({
  getRedis: () => mockRedis,
}));

// We need to test cache after mocking Redis
// Use dynamic import to ensure mocks are applied
const { cache } = await import('../utils/cache.js');

describe('cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ name: 'test' }));
      const result = await cache.get('key1');
      expect(result).toEqual({ name: 'test' });
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await cache.get('missing-key');
      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      const result = await cache.get('key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await cache.set('key1', { data: 123 }, 60);
      expect(mockRedis.set).toHaveBeenCalledWith('key1', JSON.stringify({ data: 123 }), 'EX', 60);
    });

    it('should use default TTL of 300s', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await cache.set('key1', 'value');
      expect(mockRedis.set).toHaveBeenCalledWith('key1', '"value"', 'EX', 300);
    });
  });

  describe('del', () => {
    it('should delete specified keys', async () => {
      mockRedis.del.mockResolvedValue(2);
      await cache.del('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should not call del if no keys provided', async () => {
      await cache.del();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('delPattern', () => {
    it('should scan and delete matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);
      mockRedis.del.mockResolvedValue(1);

      await cache.delPattern('products:*');

      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
      expect(mockRedis.del).toHaveBeenCalledWith('key3');
    });

    it('should handle empty scan results', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);
      await cache.delPattern('empty:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify('cached'));
      const fetchFn = vi.fn();

      const result = await cache.getOrSet('key', fetchFn);

      expect(result).toBe('cached');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      // For the lock
      mockRedis.set.mockResolvedValueOnce('OK'); // lock acquired

      const fetchFn = vi.fn().mockResolvedValue('computed');
      const result = await cache.getOrSet('key', fetchFn, 60);

      expect(result).toBe('computed');
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should wait and retry if lock is held', async () => {
      // First get returns null (miss)
      mockRedis.get
        .mockResolvedValueOnce(null) // initial miss
        .mockResolvedValueOnce(null) // retry 1
        .mockResolvedValueOnce(JSON.stringify('from-other-process')); // retry 2

      // Lock not acquired
      mockRedis.set.mockResolvedValueOnce(null); // NX fails

      const fetchFn = vi.fn();
      const result = await cache.getOrSet('key', fetchFn);

      expect(result).toBe('from-other-process');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
