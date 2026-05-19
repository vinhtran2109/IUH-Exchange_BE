import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    jwt: { secret: 'test-secret', expiration: '15m', refreshExpiration: '7d' },
    gatewaySecret: '',
  },
}));

import jwt from 'jsonwebtoken';
import { authenticate, optionalAuth, verifyGatewaySignature, authorize } from '../middleware/auth.js';

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = vi.fn();
  });

  describe('authenticate', () => {
    it('should throw if no Authorization header', () => {
      expect(() => authenticate(req, res, next)).toThrow('Missing or invalid Authorization header');
    });

    it('should throw if Authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic abc123';
      expect(() => authenticate(req, res, next)).toThrow('Missing or invalid Authorization header');
    });

    it('should set req.user and call next for valid token', () => {
      const token = jwt.sign({ sub: 'user-1', role: 'STUDENT' }, 'test-secret');
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('user-1');
      expect(next).toHaveBeenCalled();
    });

    it('should throw for invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      expect(() => authenticate(req, res, next)).toThrow('Invalid or expired token');
    });

    it('should throw for expired token', () => {
      const token = jwt.sign({ sub: 'user-1' }, 'test-secret', { expiresIn: '0s' });
      req.headers.authorization = `Bearer ${token}`;

      expect(() => authenticate(req, res, next)).toThrow('Invalid or expired token');
    });
  });

  describe('optionalAuth', () => {
    it('should call next without setting user if no token', () => {
      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set req.user if valid token provided', () => {
      const token = jwt.sign({ sub: 'user-1', role: 'STUDENT' }, 'test-secret');
      req.headers.authorization = `Bearer ${token}`;

      optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('user-1');
      expect(next).toHaveBeenCalled();
    });

    it('should call next even if token is invalid', () => {
      req.headers.authorization = 'Bearer invalid-token';

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should throw if no user on request', () => {
      const middleware = authorize('CAN_POST');

      expect(() => middleware(req, res, next)).toThrow('Authentication required');
    });

    it('should call next if user has required permission', () => {
      req.user = { sub: 'user-1', permissions: ['CAN_POST', 'CAN_CHAT'] };
      const middleware = authorize('CAN_POST');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should throw if user lacks required permission', () => {
      req.user = { sub: 'user-1', permissions: ['CAN_CHAT'] };
      const middleware = authorize('CAN_POST');

      expect(() => middleware(req, res, next)).toThrow('Insufficient permissions');
    });

    it('should require all specified permissions', () => {
      req.user = { sub: 'user-1', permissions: ['CAN_POST'] };
      const middleware = authorize('CAN_POST', 'CAN_CHAT');

      expect(() => middleware(req, res, next)).toThrow('Insufficient permissions');
    });
  });

  describe('verifyGatewaySignature', () => {
    it('should set req.user from headers when no gateway secret', () => {
      req.headers['x-user-id'] = 'user-1';
      req.headers['x-user-role'] = 'STUDENT';
      req.headers['x-user-email'] = 'test@iuh.edu.vn';

      verifyGatewaySignature(req, res, next);

      expect(req.user.sub).toBe('user-1');
      expect(req.user.role).toBe('STUDENT');
      expect(next).toHaveBeenCalled();
    });
  });
});
