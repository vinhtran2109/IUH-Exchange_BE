import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ioredis ──
const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
  status: 'ready',
};

function MockIORedis() {
  Object.assign(this, mockRedisInstance);
  return this;
}

vi.mock('ioredis', () => ({ default: MockIORedis }));

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../config/index.js', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'testpass',
    },
  },
}));

import { getRedis, createRedis } from '../utils/redis.js';

describe('redis utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRedis', () => {
    it('should create a Redis client with default config', () => {
      const client = createRedis();
      expect(client).toBeDefined();
      expect(client.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should accept override config', () => {
      const client = createRedis({ host: 'custom-host', port: 6380 });
      expect(client).toBeDefined();
    });
  });

  describe('getRedis', () => {
    it('should return a Redis client instance', () => {
      const client = getRedis();
      expect(client).toBeDefined();
    });
  });
});
