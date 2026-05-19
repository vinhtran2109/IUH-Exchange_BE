import { describe, it, expect, vi } from 'vitest';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

describe('notification-service email.service', () => {
  it('should export sendOrderEmail function', async () => {
    const { sendOrderEmail } = await import('../services/email.service.js');
    expect(typeof sendOrderEmail).toBe('function');
  });
});
