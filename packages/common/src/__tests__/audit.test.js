import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockAuditLog = {
  create: vi.fn().mockResolvedValue({ _id: 'log123' }),
};

vi.mock('../models/AuditLog.js', () => ({
  AuditLog: mockAuditLog,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { auditLog } = await import('../middleware/audit.js');

function mockReqRes(method = 'POST', path = '/api/v1/users/profile', user = { sub: 'user123' }) {
  const listeners = {};
  const req = {
    method,
    originalUrl: path,
    path,
    params: {},
    query: {},
    headers: {
      'user-agent': 'test-agent',
      'x-forwarded-for': '127.0.0.1',
    },
    ip: '127.0.0.1',
    user,
  };
  const res = {
    statusCode: 200,
    json: vi.fn().mockReturnValue({}),
    on: (event, cb) => {
      listeners[event] = cb;
    },
    _triggerFinish: () => {
      if (listeners.finish) listeners.finish();
    },
  };
  return { req, res, listeners };
}

describe('audit middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip GET requests by default', () => {
    const middleware = auditLog();
    const { req, res } = mockReqRes('GET', '/api/v1/users');
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // Simulate finish - should not create audit log
    res._triggerFinish();
    // Give async callback time to execute
    return new Promise((resolve) => setTimeout(() => {
      expect(mockAuditLog.create).not.toHaveBeenCalled();
      resolve();
    }, 50));
  });

  it('should log POST requests', async () => {
    const middleware = auditLog();
    const { req, res } = mockReqRes('POST', '/api/v1/auth/login');
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    // Simulate response finish
    res._triggerFinish();

    // Wait for async audit log creation
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockAuditLog.create).toHaveBeenCalled();
    const logEntry = mockAuditLog.create.mock.calls[0][0];
    expect(logEntry.action).toBe('USER_LOGIN');
    expect(logEntry.method).toBe('POST');
    expect(logEntry.userId).toBe('user123');
  });

  it('should log PUT requests as UPDATE', async () => {
    const middleware = auditLog();
    const { req, res } = mockReqRes('PUT', '/api/v1/users/profile');
    const next = vi.fn();

    middleware(req, res, next);
    res._triggerFinish();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockAuditLog.create).toHaveBeenCalled();
    const logEntry = mockAuditLog.create.mock.calls[0][0];
    expect(logEntry.action).toBe('UPDATE');
  });

  it('should log DELETE requests', async () => {
    const middleware = auditLog();
    const { req, res } = mockReqRes('DELETE', '/api/v1/products/prod123');
    req.params = { id: 'prod123' };
    const next = vi.fn();

    middleware(req, res, next);
    res._triggerFinish();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockAuditLog.create).toHaveBeenCalled();
    const logEntry = mockAuditLog.create.mock.calls[0][0];
    expect(logEntry.action).toBe('DELETE');
    expect(logEntry.resourceId).toBe('prod123');
  });

  it('should log GET requests when logReads is enabled', async () => {
    const middleware = auditLog({ logReads: true });
    const { req, res } = mockReqRes('GET', '/api/v1/users/me');
    const next = vi.fn();

    middleware(req, res, next);
    res._triggerFinish();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockAuditLog.create).toHaveBeenCalled();
    const logEntry = mockAuditLog.create.mock.calls[0][0];
    expect(logEntry.action).toBe('READ');
  });

  it('should handle missing user gracefully', async () => {
    const middleware = auditLog();
    const { req, res } = mockReqRes('POST', '/api/v1/auth/register', null);
    const next = vi.fn();

    middleware(req, res, next);
    res._triggerFinish();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockAuditLog.create).toHaveBeenCalled();
    const logEntry = mockAuditLog.create.mock.calls[0][0];
    expect(logEntry.userId).toBeNull();
  });

  it('should not break request if audit log creation fails', async () => {
    mockAuditLog.create.mockRejectedValueOnce(new Error('DB error'));

    const middleware = auditLog();
    const { req, res } = mockReqRes('POST', '/api/v1/products');
    const next = vi.fn();

    middleware(req, res, next);
    res._triggerFinish();

    // Should not throw - just log warning
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(next).toHaveBeenCalled();
  });
});
