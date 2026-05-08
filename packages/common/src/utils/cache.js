import { getRedis } from './redis.js';
import { logger } from './logger.js';

/**
 * Redis caching layer for microservices.
 * Usage:
 *   import { cache } from '@iuh-exchange/common';
 *   const data = await cache.getOrSet('products:page:0', async () => { ... }, 300);
 */

const DEFAULT_TTL = 300; // 5 minutes

export const cache = {
  /**
   * Get value from cache.
   */
  async get(key) {
    try {
      const redis = getRedis();
      const value = await redis.get(key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (err) {
      logger.error(`Cache GET error for ${key}:`, err);
      return null;
    }
  },

  /**
   * Set value in cache with TTL (seconds).
   */
  async set(key, value, ttlSeconds = DEFAULT_TTL) {
    try {
      const redis = getRedis();
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
      logger.error(`Cache SET error for ${key}:`, err);
    }
  },

  /**
   * Delete one or more keys.
   */
  async del(...keys) {
    try {
      const redis = getRedis();
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug(`Cache DEL: ${keys.join(', ')}`);
      }
    } catch (err) {
      logger.error(`Cache DEL error:`, err);
    }
  },

  /**
   * Delete all keys matching a pattern (e.g., "products:*").
   */
  async delPattern(pattern) {
    try {
      const redis = getRedis();
      // Bug #18 fix: Use SCAN instead of KEYS to avoid blocking Redis in production
      let cursor = '0';
      let totalDeleted = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');
      if (totalDeleted > 0) {
        logger.debug(`Cache DEL pattern "${pattern}": ${totalDeleted} keys removed`);
      }
    } catch (err) {
      logger.error(`Cache DEL pattern error:`, err);
    }
  },

  /**
   * Get from cache, or compute and store if missing.
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to compute value on miss
   * @param {number} [ttlSeconds] - TTL in seconds (default 300)
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetchFn, ttlSeconds = DEFAULT_TTL) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    // Bug #12 fix: Cache stampede protection — use Redis lock to prevent
    // concurrent requests from all computing the same value
    const lockKey = `lock:${key}`;
    const lockTtl = 10; // 10 seconds max lock hold
    const redis = getRedis();

    try {
      const acquired = await redis.set(lockKey, '1', 'EX', lockTtl, 'NX');
      if (!acquired) {
        // Another process is computing — wait and retry from cache
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 250));
          const retryCached = await this.get(key);
          if (retryCached !== null) return retryCached;
        }
        // Timeout waiting — proceed to compute anyway (fallback)
      }

      const value = await fetchFn();
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttlSeconds);
      }
      return value;
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  },

  /**
   * Wrap an Express controller with cache-aside pattern.
   * @param {string} keyFn - Function(req) => cache key string
   * @param {number} ttlSeconds - TTL in seconds
   */
  middleware(keyFn, ttlSeconds = DEFAULT_TTL) {
    return async (req, res, next) => {
      try {
        const key = typeof keyFn === 'function' ? keyFn(req) : keyFn;
        const cached = await cache.get(key);
        if (cached) {
          return res.json(cached);
        }

        // Override res.json to intercept and cache the response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            cache.set(key, body, ttlSeconds).catch(() => {});
          }
          return originalJson(body);
        };
        next();
      } catch (err) {
        next();
      }
    };
  },
};
