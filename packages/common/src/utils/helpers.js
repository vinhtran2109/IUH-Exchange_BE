import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config/index.js';

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
 * Compare a plaintext token against a SHA-256 hash
 */
export function compareToken(token, hash) {
  return hashToken(token) === hash;
}
