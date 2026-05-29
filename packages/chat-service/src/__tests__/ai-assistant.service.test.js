import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const { askAiAssistant } = await import('../services/ai-assistant.service.js');

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
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should fail when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(askAiAssistant('Hello')).rejects.toThrow('GEMINI_API_KEY is not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
