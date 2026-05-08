/**
 * Request/response logging middleware with correlation IDs.
 *
 * - Generates or forwards X-Request-ID
 * - Logs incoming request: method, path, IP, user
 * - Logs response: status, elapsed time
 * - Redacts sensitive headers (Authorization, Cookie)
 */

import crypto from 'node:crypto';
import { logger } from '@iuh-exchange/common';

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

/**
 * Inject correlation ID (X-Request-ID) into every request/response.
 */
export function correlationId(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Redact token from URL query params (e.g., SockJS ?token=xxx).
 */
function sanitizeUrl(url) {
  // Bug #16 fix: Redact JWT token from URL to prevent leaking in logs/browser history
  return url.replace(/([?&])token=[^&]*/gi, '$1token=[REDACTED]');
}

/**
 * Log request start and response completion.
 * Must be registered after correlationId().
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method } = req;
  const originalUrl = sanitizeUrl(req.originalUrl);
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';

  // Redact sensitive headers for logging
  const safeHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    safeHeaders[key] = SENSITIVE_HEADERS.has(key) ? '[REDACTED]' : value;
  }

  logger.info(`[${req.requestId}] → ${method} ${originalUrl} | ip=${ip} user=${userId}`);

  res.on('finish', () => {
    const elapsed = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger[level](
      `[${req.requestId}] ← ${status} ${method} ${originalUrl} | ${elapsed}ms`,
    );
  });

  next();
}
