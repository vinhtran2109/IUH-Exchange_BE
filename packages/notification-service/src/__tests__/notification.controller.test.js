import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockNotification = {
  _id: 'notif123',
  recipientId: 'user123',
  type: 'ORDER',
  message: 'Đơn hàng đã được xác nhận',
  targetId: 'order123',
  isRead: false,
  createdAt: new Date(),
};

const mockNotifModel = {
  find: vi.fn().mockReturnThis(),
  findOneAndUpdate: vi.fn(),
  findOneAndDelete: vi.fn(),
  countDocuments: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
  updateMany: vi.fn(),
};

vi.mock('../models/Notification.js', () => ({
  Notification: mockNotifModel,
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const notifController = await import('../controllers/notification.controller.js');

function mockReqRes(body = {}, params = {}, query = {}, user = { sub: 'user123' }) {
  const req = { body, params, query, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('notification.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifModel.find.mockReturnThis();
    mockNotifModel.sort.mockReturnThis();
    mockNotifModel.skip.mockReturnThis();
    mockNotifModel.limit.mockReturnThis();
    mockNotifModel.lean.mockReturnThis();
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      mockNotifModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([{ ...mockNotification }]),
            }),
          }),
        }),
      });
      mockNotifModel.countDocuments.mockResolvedValue(1);

      const { req, res, next } = mockReqRes({}, {}, { page: '1', size: '20' });
      await notifController.getNotifications(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
    });

    it('should filter by type', async () => {
      mockNotifModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      mockNotifModel.countDocuments.mockResolvedValue(0);

      const { req, res, next } = mockReqRes({}, {}, { type: 'ORDER' });
      await notifController.getNotifications(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject invalid type', async () => {
      const { req, res, next } = mockReqRes({}, {}, { type: 'INVALID' });
      await notifController.getNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotifModel.countDocuments.mockResolvedValue(5);

      const { req, res, next } = mockReqRes();
      await notifController.getUnreadCount(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data.count).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockNotifModel.findOneAndUpdate.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const { req, res, next } = mockReqRes({}, { id: 'notif123' });
      await notifController.markAsRead(req, res, next);

      expect(mockNotifModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif123', recipientId: 'user123' },
        { isRead: true },
        { new: true },
      );
    });

    it('should return 404 for missing notification', async () => {
      mockNotifModel.findOneAndUpdate.mockResolvedValue(null);

      const { req, res, next } = mockReqRes({}, { id: 'nonexistent' });
      await notifController.markAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotifModel.updateMany.mockResolvedValue({ modifiedCount: 10 });

      const { req, res, next } = mockReqRes();
      await notifController.markAllAsRead(req, res, next);

      expect(mockNotifModel.updateMany).toHaveBeenCalledWith(
        { recipientId: 'user123', isRead: false },
        { isRead: true },
        { limit: 1000 },
      );
      const response = res.json.mock.calls[0][0];
      expect(response.data.modifiedCount).toBe(10);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockNotifModel.findOneAndDelete.mockResolvedValue({ ...mockNotification });

      const { req, res, next } = mockReqRes({}, { id: 'notif123' });
      await notifController.deleteNotification(req, res, next);

      expect(mockNotifModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'notif123',
        recipientId: 'user123',
      });
    });

    it('should return 404 for missing notification', async () => {
      mockNotifModel.findOneAndDelete.mockResolvedValue(null);

      const { req, res, next } = mockReqRes({}, { id: 'nonexistent' });
      await notifController.deleteNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
