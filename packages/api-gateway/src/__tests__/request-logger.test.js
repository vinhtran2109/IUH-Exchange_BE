import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

import { correlationId, requestLogger } from '../middleware/request-logger.js';
import { logger } from '@iuh-exchange/common';

describe('api-gateway request-logger', () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: 'GET',
      originalUrl: '/api/v1/products',
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };
    res = {
      setHeader: vi.fn(),
      statusCode: 200,
      on: vi.fn(),
    };
    next = vi.fn();
  });

  describe('correlationId', () => {
    it('should generate new request ID if not present', () => {
      correlationId(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
      expect(next).toHaveBeenCalled();
    });

    it('should forward existing X-Request-ID', () => {
      req.headers['x-request-id'] = 'existing-id-123';

      correlationId(req, res, next);

      expect(req.requestId).toBe('existing-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id-123');
    });
  });

  describe('requestLogger', () => {
    it('should log request and register finish handler', () => {
      req.requestId = 'test-req-id';

      requestLogger(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('test-req-id')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();
    });

    it('should redact token from URL in logs', () => {
      req.requestId = 'test-req-id';
      req.originalUrl = '/ws/info?token=eyJhbGciOiJIUzI1NiJ9.secret';

      requestLogger(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[REDACTED]')
      );
    });

    it('should log warning for 4xx status', () => {
      req.requestId = 'test-req-id';

      requestLogger(req, res, next);

      // Simulate response finish with 4xx status
      const finishHandler = res.on.mock.calls[0][1];
      res.statusCode = 404;
      finishHandler();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('404')
      );
    });

    it('should log error for 5xx status', () => {
      req.requestId = 'test-req-id';

      requestLogger(req, res, next);

      const finishHandler = res.on.mock.calls[0][1];
      res.statusCode = 500;
      finishHandler();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('500')
      );
    });
  });
});
