/**
 * OCR Rate-Limit Middleware — Redis-backed (BUG FIX #11)
 *
 * Phiên bản cũ dùng in-memory Map → không hoạt động đúng khi scale
 * nhiều instance (mỗi pod có counter riêng → user có thể gửi MAX × N requests).
 *
 * Phiên bản mới dùng Redis Sliding Window Counter:
 *   - Key: `ocr:rl:{userId}` với TTL = window size
 *   - INCR atomic → không bao giờ race condition
 *   - Tự động expire qua Redis TTL → không cần cleanup job
 *   - Hoạt động chính xác kể cả khi scale ngang (horizontal scaling)
 *
 * Config via env:
 *   OCR_RATE_LIMIT_MAX    — max requests per window (default: 20)
 *   OCR_RATE_LIMIT_WINDOW — window in minutes (default: 60)
 */

import { getRedis, TooManyRequestsException, logger } from '@iuh-exchange/common';

const MAX_REQUESTS = parseInt(process.env.OCR_RATE_LIMIT_MAX) || 20;
const WINDOW_SECONDS = (parseInt(process.env.OCR_RATE_LIMIT_WINDOW) || 60) * 60;

/**
 * Express middleware: giới hạn số lần OCR per user per window.
 * Phải dùng sau `authenticate` middleware (cần req.user.sub).
 *
 * Dùng Redis INCR + EXPIRE (Fixed Window Counter Pattern):
 *   - Lần gọi đầu tiên trong window → INCR tạo key mới → EXPIRE set TTL
 *   - Các lần tiếp theo → INCR tăng counter, EXPIRE giữ nguyên TTL
 *   - Khi TTL hết → Redis tự xóa key → window mới bắt đầu
 */
export async function ocrRateLimit(req, res, next) {
  const userId = req.user?.sub;

  // Nếu không có user (unauthenticated) → skip, để auth middleware xử lý
  if (!userId) return next();

  const key = `ocr:rl:${userId}`;

  try {
    const redis = getRedis();

    // INCR atomic: tăng counter và trả về giá trị mới
    const count = await redis.incr(key);

    // Chỉ set TTL khi counter = 1 (lần đầu trong window mới)
    // Không ghi đè TTL ở các lần tiếp theo → giữ nguyên thời điểm reset
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    // Tính thời điểm reset để trả về header
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + ttl * 1000).toISOString();
    const remaining = Math.max(0, MAX_REQUESTS - count);

    // Headers chuẩn RateLimit (RFC 6585)
    res.set('X-OCR-Limit', String(MAX_REQUESTS));
    res.set('X-OCR-Remaining', String(remaining));
    res.set('X-OCR-Reset', resetAt);
    res.set('X-OCR-Window', `${WINDOW_SECONDS}s`);

    if (count > MAX_REQUESTS) {
      logger.warn(
        `[OCR RateLimit] userId=${userId} exceeded: ${count}/${MAX_REQUESTS} ` +
        `(resets in ${ttl}s)`
      );
      throw new TooManyRequestsException(
        `OCR rate limit exceeded. Max ${MAX_REQUESTS} requests per ${WINDOW_SECONDS / 60} minutes. ` +
        `Resets at ${resetAt}.`
      );
    }

    logger.debug(`[OCR RateLimit] userId=${userId}: ${count}/${MAX_REQUESTS}`);
    next();
  } catch (err) {
    if (err instanceof TooManyRequestsException) {
      // Re-throw rate limit errors bình thường
      return next(err);
    }

    // Redis lỗi → fail-open (cho phép tiếp tục) để không block toàn bộ OCR
    // khi Redis tạm thời down. Log để monitor.
    logger.error(
      `[OCR RateLimit] Redis error cho userId=${userId}: ${err.message}. ` +
      `Fail-open: cho phép request tiếp tục.`
    );
    next();
  }
}
