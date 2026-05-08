import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockChatMessage = {
  _id: 'msg123',
  senderId: 'user1',
  receiverId: 'user2',
  content: 'Hello!',
  conversationId: 'user1:user2',
  isRead: false,
  createdAt: new Date(),
  toObject: vi.fn().mockReturnThis(),
};

const mockChatModel = {
  find: vi.fn().mockReturnThis(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  create: vi.fn(),
  updateMany: vi.fn(),
  aggregate: vi.fn(),
};

vi.mock('../models/ChatMessage.js', () => ({
  ChatMessage: mockChatModel,
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const chatController = await import('../controllers/chat.controller.js');

function mockReqRes(body = {}, params = {}, query = {}, user = { sub: 'user1' }) {
  const req = { body, params, query, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('chat.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatModel.find.mockReturnThis();
    mockChatModel.sort.mockReturnThis();
    mockChatModel.skip.mockReturnThis();
    mockChatModel.limit.mockReturnThis();
    mockChatModel.lean.mockReturnThis();
  });

  describe('getUserConversations', () => {
    it('should return paginated conversations', async () => {
      mockChatModel.aggregate.mockResolvedValue([{
        metadata: [{ total: 2 }],
        content: [
          { _id: 'user1:user2', lastMessage: { content: 'Hi' }, unreadCount: 1 },
          { _id: 'user1:user3', lastMessage: { content: 'Hey' }, unreadCount: 0 },
        ],
      }]);

      const { req, res, next } = mockReqRes({}, {}, { page: '1', size: '20' });
      await chatController.getUserConversations(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
    });

    it('should handle empty conversations', async () => {
      mockChatModel.aggregate.mockResolvedValue([{
        metadata: [],
        content: [],
      }]);

      const { req, res, next } = mockReqRes({}, {}, { page: '1', size: '20' });
      await chatController.getUserConversations(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.content).toHaveLength(0);
    });
  });

  describe('getConversationHistory', () => {
    it('should return message history', async () => {
      const messages = [
        { ...mockChatMessage, content: 'Hello' },
        { ...mockChatMessage, _id: 'msg124', content: 'Hi there' },
      ];
      mockChatModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(messages),
            }),
          }),
        }),
      });
      mockChatModel.countDocuments.mockResolvedValue(2);

      const { req, res, next } = mockReqRes({}, { conversationId: 'user1:user2' }, { page: '1', size: '20' });
      await chatController.getConversationHistory(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should validate conversationId format', async () => {
      const { req, res, next } = mockReqRes({}, { conversationId: 'invalid-format-no-colon' }, {});
      await chatController.getConversationHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark messages as read', async () => {
      mockChatModel.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const { req, res, next } = mockReqRes({}, { conversationId: 'user1:user2' });
      await chatController.markConversationAsRead(req, res, next);

      expect(mockChatModel.updateMany).toHaveBeenCalledWith(
        { conversationId: 'user1:user2', receiverId: 'user1', isRead: false },
        { isRead: true },
      );
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('markAllConversationsAsRead', () => {
    it('should mark all messages as read', async () => {
      mockChatModel.updateMany.mockResolvedValue({ modifiedCount: 10 });

      const { req, res, next } = mockReqRes();
      await chatController.markAllConversationsAsRead(req, res, next);

      expect(mockChatModel.updateMany).toHaveBeenCalledWith(
        { receiverId: 'user1', isRead: false },
        { isRead: true },
      );
    });
  });

  describe('searchMessages', () => {
    it('should search messages by keyword', async () => {
      mockChatModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([{ ...mockChatMessage }]),
            }),
          }),
        }),
      });
      mockChatModel.countDocuments.mockResolvedValue(1);

      const { req, res, next } = mockReqRes({}, {}, { q: 'hello', page: '1', size: '20' });
      await chatController.searchMessages(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return empty for short query', async () => {
      const { req, res, next } = mockReqRes({}, {}, { q: 'a' });
      await chatController.searchMessages(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.content).toHaveLength(0);
    });

    it('should escape regex special chars in search query', async () => {
      mockChatModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      mockChatModel.countDocuments.mockResolvedValue(0);

      const { req, res, next } = mockReqRes({}, {}, { q: 'test.*+?', page: '1', size: '20' });
      await chatController.searchMessages(req, res, next);

      // Should not throw regex error
      expect(res.json).toHaveBeenCalled();
    });
  });
});
