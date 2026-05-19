/**
 * OCR Rate-Limit Middleware
 *
 * Limits the number of image analysis requests per user per time window.
 * Uses in-memory store (Map) — for production, use Redis-backed rate limiting.
 *
 * Config via env:
 *   OCR_RATE_LIMIT_MAX    — max requests per window (default: 20)
 *   OCR_RATE_LIMIT_WINDOW — window in minutes (default: 60)
 */

import { TooManyRequestsException } from '@iuh-exchange/common';

const MAX_REQUESTS = parseInt(process.env.OCR_RATE_LIMIT_MAX) || 20;
const WINDOW_MS = (parseInt(process.env.OCR_RATE_LIMIT_WINDOW) || 60) * 60 * 1000;

// In-memory store: userId → { count, resetAt }
const store = new Map();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (val.resetAt <= now) store.delete(key);
  }
}, 10 * 60 * 1000).unref();

/**
 * Express middleware: check if user has exceeded OCR quota.
 * Must be used after `authenticate` middleware (needs req.user.sub).
 */
export function ocrRateLimit(req, res, next) {
  const userId = req.user?.sub;
  if (!userId) return next(); // Skip for unauthenticated (shouldn't happen)

  const now = Date.now();
  let entry = store.get(userId);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(userId, entry);
  }

  entry.count++;

  // Set rate-limit headers
  res.set('X-OCR-Limit', String(MAX_REQUESTS));
  res.set('X-OCR-Remaining', String(Math.max(0, MAX_REQUESTS - entry.count)));
  res.set('X-OCR-Reset', new Date(entry.resetAt).toISOString());

  if (entry.count > MAX_REQUESTS) {
    throw new TooManyRequestsException(
      `OCR rate limit exceeded. Max ${MAX_REQUESTS} requests per ${WINDOW_MS / 60000} minutes.`
    );
  }

  next();
}
