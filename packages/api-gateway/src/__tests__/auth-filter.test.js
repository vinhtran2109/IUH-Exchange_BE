import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    config: {
      jwt: { secret: 'test-secret-key' },
      gatewaySecret: 'gateway-secret',
    },
  };
});

import { authFilter, optionalAuthFilter } from '../middleware/auth-filter.js';
import { config } from '@iuh-exchange/common';

describe('api-gateway auth-filter', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe('authFilter', () => {
    it('should pass OPTIONS requests without auth', () => {
      req.method = 'OPTIONS';
      authFilter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests without Authorization header', () => {
      authFilter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Missing or invalid Authorization header' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with non-Bearer token', () => {
      req.headers.authorization = 'Basic abc123';
      authFilter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should accept valid JWT and inject headers', () => {
      const token = jwt.sign(
        { sub: 'user-1', role: 'STUDENT', email: 'test@iuh.edu.vn' },
        config.jwt.secret
      );
      req.headers.authorization = `Bearer ${token}`;

      authFilter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.headers['x-user-id']).toBe('user-1');
      expect(req.headers['x-user-role']).toBe('STUDENT');
      expect(req.headers['x-user-email']).toBe('test@iuh.edu.vn');
      expect(req.headers['x-gateway-signature']).toBeDefined();
      expect(req.user).toEqual(
        expect.objectContaining({ id: 'user-1', role: 'STUDENT', email: 'test@iuh.edu.vn' })
      );
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { sub: 'user-1', role: 'STUDENT', email: 'test@iuh.edu.vn' },
        config.jwt.secret,
        { expiresIn: '-1s' }
      );
      req.headers.authorization = `Bearer ${token}`;

      authFilter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Token has expired' })
      );
    });

    it('should reject token signed with wrong secret', () => {
      const token = jwt.sign(
        { sub: 'user-1', role: 'STUDENT' },
        'wrong-secret'
      );
      req.headers.authorization = `Bearer ${token}`;

      authFilter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid token' })
      );
    });
  });

  describe('optionalAuthFilter', () => {
    it('should pass OPTIONS requests', () => {
      req.method = 'OPTIONS';
      optionalAuthFilter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass without auth header (no rejection)', () => {
      optionalAuthFilter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should decode valid token if present', () => {
      const token = jwt.sign(
        { sub: 'user-1', role: 'STUDENT', email: 'test@iuh.edu.vn' },
        config.jwt.secret
      );
      req.headers.authorization = `Bearer ${token}`;

      optionalAuthFilter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
    });

    it('should proceed without identity for invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      optionalAuthFilter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
