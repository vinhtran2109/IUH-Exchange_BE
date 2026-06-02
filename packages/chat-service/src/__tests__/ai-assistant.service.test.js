import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const { askAiAssistant, searchProductsTool, searchLostFoundTool, getMyOrdersTool } = await import('../services/ai-assistant.service.js');

describe('ai-assistant.service', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    vi.clearAllMocks();
  });

  it('should call Gemini and return assistant answer', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Bạn nên viết tiêu đề rõ ràng và thêm ảnh thật.' }],
          },
        }],
      }),
    });

    const result = await askAiAssistant('Tư vấn đăng bán laptop cũ', { userId: 'user1' });

    expect(result.answer).toContain('tiêu đề');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.5-flash:generateContent?key=test-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('searchProductsTool'),
      }),
    );
  });

  it('should execute searchProductsTool when Gemini requests it', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'searchProductsTool',
                  args: { keyword: 'tai nghe', size: 2 },
                },
              }],
            },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            content: [{
              id: 'p1',
              title: 'Tai nghe AP2',
              price: 999000,
              category: 'ELECTRONICS',
              condition: 'Moi',
              imageUrls: ['https://example.com/headphone.jpg'],
            }],
            totalElements: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [{
            content: {
              parts: [{ text: 'Mình tìm thấy Tai nghe AP2 giá 999.000đ.' }],
            },
          }],
        }),
      });

    const result = await askAiAssistant('Tìm tai nghe giúp mình', { userId: 'user1' });

    expect(result.answer).toContain('Tai nghe AP2');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('searchProductsTool');
    expect(global.fetch.mock.calls[1][0].toString()).toContain('/api/v1/products/search');
    expect(global.fetch.mock.calls[2][1].body).toContain('functionResponse');
  });

  it('searchProductsTool should compact product search results', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          content: [{
            id: 'p1',
            title: 'Sach kien truc',
            price: 50000,
            category: 'BOOKS',
            condition: 'Con moi',
            location: 'Nha H',
            imageUrls: ['https://example.com/book.jpg'],
          }],
          totalElements: 1,
        },
      }),
    });

    const result = await searchProductsTool({ keyword: 'sach', size: 5 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'p1',
      title: 'Sach kien truc',
      url: '/products/p1',
    });
    expect(global.fetch.mock.calls[0][0].toString()).toContain('keyword=sach');
  });

  it('searchLostFoundTool should compact lost-found results', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          content: [{
            id: 'lf1',
            type: 'FOUND',
            title: 'Nhat duoc chia khoa',
            status: 'OPEN',
            location: 'Tang ham',
            userName: 'Nguyen Van A',
            studentId: '22660001',
            imageUrls: ['https://example.com/key.jpg'],
          }],
          totalElements: 1,
        },
      }),
    });

    const result = await searchLostFoundTool({ keyword: 'chia khoa', type: 'FOUND' });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'lf1',
      type: 'FOUND',
      title: 'Nhat duoc chia khoa',
      url: '/lost-found/lf1',
    });
    expect(global.fetch.mock.calls[0][0].toString()).toContain('type=FOUND');
  });

  it('getMyOrdersTool should require authenticated context', async () => {
    const result = await getMyOrdersTool({}, {});

    expect(result.error).toContain('đăng nhập');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('getMyOrdersTool should fetch and compact authenticated orders', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{
          id: 'o1',
          productTitle: 'Giao trinh PLC',
          price: 120000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          buyerName: 'Nguoi mua',
          sellerName: 'Nguoi ban',
        }],
      }),
    });

    const result = await getMyOrdersTool({ limit: 3 }, { authHeader: 'Bearer test-token' });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'o1',
      productTitle: 'Giao trinh PLC',
      url: '/orders/o1',
    });
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('should fail when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(askAiAssistant('Hello')).rejects.toThrow('GEMINI_API_KEY is not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
