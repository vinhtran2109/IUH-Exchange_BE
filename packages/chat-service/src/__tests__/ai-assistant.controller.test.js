import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAskAiAssistant = vi.fn();

vi.mock('../services/ai-assistant.service.js', () => ({
  askAiAssistant: mockAskAiAssistant,
}));

const { chatWithAiAssistant } = await import('../controllers/ai-assistant.controller.js');

function mockReqRes(body = {}, user = { sub: 'user1' }) {
  const req = { body, user };
  const res = {
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('ai-assistant.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return AI assistant response', async () => {
    mockAskAiAssistant.mockResolvedValue({
      answer: 'Bạn nên đăng giá 5-6 triệu nếu máy còn tốt.',
      model: 'gemini-2.5-flash',
    });

    const { req, res, next } = mockReqRes({ message: 'Laptop cũ nên bán giá bao nhiêu?' });
    await chatWithAiAssistant(req, res, next);

    expect(mockAskAiAssistant).toHaveBeenCalledWith(
      'Laptop cũ nên bán giá bao nhiêu?',
      { userId: 'user1', locale: 'vi-VN' },
    );
    expect(res.json).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.answer).toContain('5-6 triệu');
  });

  it('should reject empty messages', async () => {
    const { req, res, next } = mockReqRes({ message: '   ' });
    await chatWithAiAssistant(req, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Message is required',
    }));
  });
});
