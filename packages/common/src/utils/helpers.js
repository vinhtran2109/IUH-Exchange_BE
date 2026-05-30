import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const SALT_ROUNDS = 10;

/**
 * Hash password bằng bcrypt
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * So sánh password với hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Tạo JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiration,
  });
}

/**
 * Tạo JWT refresh token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiration,
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/**
 * Parse pagination query params
 * @param {object} query - Express req.query
 * @returns {{ page: number, size: number, skip: number }}
 */
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(query.size || '20', 10)));
  return { page, size, skip: (page - 1) * size };
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plaintext token against a SHA-256 hash (timing-safe).
 */
export function compareToken(token, hash) {
  const tokenHash = hashToken(token);
  // Bug #9 fix: Use timingSafeEqual to prevent timing attacks
  if (tokenHash.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

/**
 * Retry với Exponential Backoff — chỉ retry lỗi tạm thời.
 *
 * BUG FIX: Không retry lỗi 4xx (client errors) vì dữ liệu đầu vào sai,
 * retry vô ích chỉ tốn tài nguyên và làm hệ thống chậm hơn.
 * Chỉ retry: network error (không có status), 5xx (server error), 429 (rate limited).
 *
 * @param {Function} fn - Hàm async cần thực thi
 * @param {number} maxRetries - Số lần thử lại tối đa (default: 3)
 * @param {number} baseDelayMs - Độ trễ ban đầu ms, tăng lũy thừa (default: 3000 = 3s)
 * @returns {Promise<any>} Kết quả của fn khi thành công
 * @throws {Error} Lỗi cuối cùng nếu hết số lần retry
 */
export async function withRetry(fn, maxRetries = 3, baseDelayMs = 3000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      const statusCode = error?.response?.status || error?.statusCode;
      // Chỉ retry lỗi tạm thời: network/timeout, 5xx, 429
      const isRetryable =
        !statusCode ||        // Network error / timeout (không có HTTP status)
        statusCode >= 500 ||  // Server error (5xx)
        statusCode === 429;   // Too Many Requests — rate limited

      attempt++;
      if (!isRetryable || attempt >= maxRetries) throw error;

      const delay = baseDelayMs * attempt; // 3s → 6s → 9s (Exponential Backoff)
      logger.warn(
        `[withRetry] Lần ${attempt}/${maxRetries} thất bại ` +
        `(status=${statusCode || 'network_error'}). Thử lại sau ${delay / 1000}s. ` +
        `Lỗi: ${error.message}`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
