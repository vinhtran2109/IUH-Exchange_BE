import { describe, it, expect, vi } from 'vitest';

const mailerMock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mailerMock.createTransport,
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
    vi.resetModules();
    mailerMock.createTransport.mockReset();
    mailerMock.sendMail.mockReset();
    mailerMock.createTransport.mockReturnValueOnce(null);

    const { sendOrderEmail } = await import('../services/email.service.js');
    expect(typeof sendOrderEmail).toBe('function');
  });

  it('should render full order details with real buyer and seller names', async () => {
    vi.resetModules();
    mailerMock.createTransport.mockReset();
    mailerMock.sendMail.mockReset();
    process.env.SMTP_USER = 'mailer@example.com';
    process.env.SMTP_PASS = 'secret';
    mailerMock.sendMail.mockResolvedValueOnce({ messageId: 'mail-1' });
    mailerMock.createTransport.mockReturnValueOnce({ sendMail: mailerMock.sendMail });

    const { sendOrderEmail } = await import('../services/email.service.js');
    await sendOrderEmail('seller@example.com', {
      subject: 'Đơn hàng mới',
      title: 'Bạn có đơn hàng mới!',
      body: 'Vui lòng kiểm tra đơn hàng.',
      orderId: 'order-123456789',
      status: 'Chờ xác nhận',
      orderDetails: {
        buyer: { name: 'Nguyễn Văn Buyer', email: 'buyer@example.com', studentId: '21000001' },
        seller: { name: 'Trần Thị Seller', email: 'seller@example.com', studentId: '21000002' },
        product: { title: 'Giáo trình kỹ thuật đo điện', price: 15000 },
      },
    });

    const html = mailerMock.sendMail.mock.calls[0][0].html;
    expect(html).toContain('Thông tin đơn hàng');
    expect(html).toContain('Nguyễn Văn Buyer');
    expect(html).toContain('Trần Thị Seller');
    expect(html).toContain('Giáo trình kỹ thuật đo điện');
    expect(html).toContain('15.000đ');
  });
});
