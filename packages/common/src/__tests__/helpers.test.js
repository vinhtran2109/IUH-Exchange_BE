import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
  compareToken,
  parsePagination,
} from '../utils/helpers.js';

describe('helpers.js', () => {
  describe('hashPassword / comparePassword', () => {
    it('should hash password and verify correctly', async () => {
      const password = 'MySecret123!';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);

      const match = await comparePassword(password, hash);
      expect(match).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const hash = await hashPassword('correct-password');
      const match = await comparePassword('wrong-password', hash);
      expect(match).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const payload = { sub: 'user123', email: 'test@student.iuh.edu.vn', role: 'STUDENT' };

    it('should generate and verify access token', () => {
      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should generate and verify refresh token', () => {
      const token = generateRefreshToken({ sub: payload.sub });
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(payload.sub);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    it('should throw on expired token', () => {
      // Generate a token that's already expired
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '-1s' });
      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });

  describe('hashToken / compareToken', () => {
    it('should hash token and compare correctly', () => {
      const token = 'my-refresh-token-value';
      const hash = hashToken(token);

      expect(hash).not.toBe(token);
      expect(hash.length).toBe(64); // SHA-256 hex = 64 chars

      expect(compareToken(token, hash)).toBe(true);
    });

    it('should return false for wrong token', () => {
      const hash = hashToken('correct-token');
      expect(compareToken('wrong-token', hash)).toBe(false);
    });
  });

  describe('parsePagination', () => {
    it('should parse valid pagination params', () => {
      const result = parsePagination({ page: '2', size: '10' });
      expect(result).toEqual({ page: 2, size: 10, skip: 10 });
    });

    it('should use defaults for missing params', () => {
      const result = parsePagination({});
      expect(result).toEqual({ page: 1, size: 20, skip: 0 });
    });

    it('should clamp page to minimum 1', () => {
      const result = parsePagination({ page: '-5' });
      expect(result.page).toBe(1);
    });

    it('should clamp size to max 100', () => {
      const result = parsePagination({ size: '500' });
      expect(result.size).toBe(100);
    });

    it('should clamp size to min 1', () => {
      const result = parsePagination({ size: '0' });
      expect(result.size).toBe(1);
    });
  });
});
