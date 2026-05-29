import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockContainsProfanity = vi.fn();

vi.mock('../services/profanity-filter.js', () => ({
  containsProfanity: mockContainsProfanity,
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const { assertProductAllowed, moderateProductContent } = await import('../services/product-moderation.service.js');

describe('product-moderation.service', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContainsProfanity.mockReturnValue(false);
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  });

  it('should allow safe listings returned by Gemini', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: '{"decision":"ALLOW","category":"OK","reason":"Phù hợp","confidence":0.96}' }],
          },
        }],
      }),
    });

    const result = await moderateProductContent({
      title: 'Giáo trình Java cũ',
      description: 'Sách còn tốt, phù hợp sinh viên IUH',
      category: 'BOOKS',
      listingType: 'SELL',
    });

    expect(result.allowed).toBe(true);
    expect(result.status).toBe('PASSED');
    expect(result.provider).toBe('gemini');
  });

  it('should reject blacklist profanity before calling Gemini', async () => {
    mockContainsProfanity.mockReturnValue(true);

    const result = await moderateProductContent({
      title: 'Bad listing',
      description: 'Bad words',
      category: 'OTHER',
    });

    expect(result.allowed).toBe(false);
    expect(result.category).toBe('PROFANITY');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(() => assertProductAllowed(result)).toThrow('Nội dung chứa từ ngữ không phù hợp');
  });

  it('should reject obvious scam patterns before calling Gemini', async () => {
    const result = await moderateProductContent({
      title: 'Nhận hàng giá rẻ',
      description: 'Chuyển khoản trước và gửi OTP để xác nhận.',
      category: 'OTHER',
    });

    expect(result.allowed).toBe(false);
    expect(result.category).toBe('SCAM');
    expect(result.provider).toBe('local-rules');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fall back to allowed when Gemini is unavailable and blacklist passes', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));

    const result = await moderateProductContent({
      title: 'Áo khoác IUH',
      description: 'Áo còn mới',
      category: 'CLOTHING',
    });

    expect(result.allowed).toBe(true);
    expect(result.status).toBe('ERROR');
    expect(result.provider).toBe('fallback');
  });
});
