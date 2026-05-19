import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('prom-client', () => {
  const mockInstance = { inc: vi.fn(), observe: vi.fn(), set: vi.fn() };
  const mockLabels = vi.fn().mockReturnValue(mockInstance);

  return {
    default: {
      Counter: vi.fn().mockReturnValue({ labels: mockLabels }),
      Histogram: vi.fn().mockReturnValue({ labels: mockLabels }),
      Gauge: vi.fn().mockReturnValue({ labels: mockLabels }),
      Registry: vi.fn().mockReturnValue({
        contentType: 'text/plain',
        metrics: vi.fn().mockResolvedValue('# HELP http_requests_total\nhttp_requests_total 5\n'),
      }),
      collectDefaultMetrics: vi.fn(),
    },
    Counter: vi.fn().mockReturnValue({ labels: mockLabels }),
    Histogram: vi.fn().mockReturnValue({ labels: mockLabels }),
    Gauge: vi.fn().mockReturnValue({ labels: mockLabels }),
    Registry: vi.fn().mockReturnValue({
      contentType: 'text/plain',
      metrics: vi.fn().mockResolvedValue('# HELP http_requests_total\nhttp_requests_total 5\n'),
    }),
    collectDefaultMetrics: vi.fn(),
  };
});

import { metricsMiddleware, metricsHandler } from '../utils/metrics.js';

describe('metrics utility', () => {
  describe('metricsMiddleware', () => {
    it('should be a function', () => {
      expect(typeof metricsMiddleware).toBe('function');
    });

    it('should call next() after recording metrics', () => {
      const req = {
        method: 'GET',
        path: '/api/test',
        route: { path: '/api/test' },
      };
      const res = {
        statusCode: 200,
        on: vi.fn((event, cb) => {
          if (event === 'finish') cb();
        }),
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('metricsHandler', () => {
    it('should return metrics as text response', async () => {
      const req = {};
      const res = {
        set: vi.fn(),
        send: vi.fn(),
      };

      await metricsHandler(req, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', expect.any(String));
      expect(res.send).toHaveBeenCalled();
    });
  });
});
