import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let redisClient = null;

/**
 * Tạo Redis connection.
 * @param {object} [override] - Override config
 * @returns {Redis}
 */
export function createRedis(override = {}) {
  const client = new Redis({
    host: override.host || config.redis.host,
    port: override.port || config.redis.port,
    password: override.password || config.redis.password,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error:', err));

  return client;
}

/**
 * Get or create singleton Redis client.
 */
export function getRedis() {
  if (!redisClient) {
    redisClient = createRedis();
  }
  return redisClient;
}
