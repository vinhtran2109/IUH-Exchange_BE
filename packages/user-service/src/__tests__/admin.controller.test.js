import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockUserModel = {
  find: vi.fn().mockReturnThis(),
  findById: vi.fn(),
  countDocuments: vi.fn(),
  select: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
};

const mockKarmaHistoryModel = {
  find: vi.fn().mockReturnThis(),
  create: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockReturnThis(),
};

vi.mock('../models/User.js', () => ({ User: mockUserModel }));
vi.mock('../models/KarmaHistory.js', () => ({ KarmaHistory: mockKarmaHistoryModel }));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const adminController = await import('../controllers/admin.controller.js');

const mockUser = {
  _id: 'user123',
  email: 'test@student.iuh.edu.vn',
  name: 'Test User',
  studentId: 'DH123456',
  avatarUrl: '',
  isVerified: true,
  isActive: true,
  karmaPoint: 100,
  role: 'STUDENT',
  permissions: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
  createdAt: new Date(),
  updatedAt: new Date(),
  save: vi.fn().mockResolvedValue(true),
  toObject: vi.fn().mockReturnThis(),
};

function mockReqRes(body = {}, params = {}, query = {}, user = { sub: 'admin1', role: 'ADMIN' }) {
  const req = { body, params, query, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('admin.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserModel.find.mockReturnThis();
    mockUserModel.select.mockReturnThis();
    mockUserModel.sort.mockReturnThis();
    mockUserModel.skip.mockReturnThis();
    mockUserModel.limit.mockReturnThis();
    mockUserModel.lean.mockReturnThis();
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      mockUserModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ...mockUser }]),
            }),
          }),
        }),
      });
      mockUserModel.countDocuments.mockResolvedValue(1);

      const { req, res } = mockReqRes({}, {}, { page: '1', size: '20' });
      await adminController.listUsers(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should filter by search term safely (no regex injection)', async () => {
      mockUserModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      mockUserModel.countDocuments.mockResolvedValue(0);

      const { req, res } = mockReqRes({}, {}, { search: 'test.*+?[' });
      await adminController.listUsers(req, res);

      // Should not throw regex error
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      mockUserModel.findById.mockResolvedValue({ ...mockUser, save: vi.fn().mockResolvedValue(true) });

      const { req, res } = mockReqRes({ role: 'MODERATOR' }, { id: 'user123' });
      await adminController.updateUserRole(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject invalid role', async () => {
      const { req, res } = mockReqRes({ role: 'SUPERADMIN' }, { id: 'user123' });
      await expect(adminController.updateUserRole(req, res)).rejects.toThrow('Role không hợp lệ');
    });
  });

  describe('adjustKarma', () => {
    it('should adjust karma and log history', async () => {
      const user = { ...mockUser, karmaPoint: 100, permissions: [...mockUser.permissions], save: vi.fn().mockResolvedValue(true) };
      mockUserModel.findById.mockResolvedValue(user);
      mockKarmaHistoryModel.create.mockResolvedValue(true);

      const { req, res } = mockReqRes({ amount: -50, reason: 'Spam' }, { id: 'user123' });
      await adminController.adjustKarma(req, res);

      expect(user.karmaPoint).toBe(50);
      expect(mockKarmaHistoryModel.create).toHaveBeenCalled();
    });

    it('should revoke CAN_POST when karma drops below 0', async () => {
      const user = {
        ...mockUser,
        karmaPoint: 10,
        permissions: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
        save: vi.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockResolvedValue(user);
      mockKarmaHistoryModel.create.mockResolvedValue(true);

      const { req, res } = mockReqRes({ amount: -20, reason: 'Lừa đảo' }, { id: 'user123' });
      await adminController.adjustKarma(req, res);

      expect(user.permissions).not.toContain('CAN_POST');
    });

    it('should restore CAN_POST when karma returns non-negative', async () => {
      const user = {
        ...mockUser,
        karmaPoint: -5,
        permissions: ['CAN_CHAT', 'CAN_REPORT'],
        save: vi.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockResolvedValue(user);
      mockKarmaHistoryModel.create.mockResolvedValue(true);

      const { req, res } = mockReqRes({ amount: 10, reason: 'Good behavior' }, { id: 'user123' });
      await adminController.adjustKarma(req, res);

      expect(user.permissions).toContain('CAN_POST');
    });
  });

  describe('toggleBanUser', () => {
    it('should ban active user', async () => {
      const user = {
        ...mockUser,
        isActive: true,
        permissions: ['CAN_POST', 'CAN_CHAT'],
        save: vi.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockResolvedValue(user);

      const { req, res } = mockReqRes({}, { id: 'user123' });
      await adminController.toggleBanUser(req, res);

      expect(user.isActive).toBe(false);
      expect(user.permissions).toEqual([]);
    });

    it('should unban inactive user', async () => {
      const user = {
        ...mockUser,
        isActive: false,
        permissions: [],
        save: vi.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockResolvedValue(user);

      const { req, res } = mockReqRes({}, { id: 'user123' });
      await adminController.toggleBanUser(req, res);

      expect(user.isActive).toBe(true);
      expect(user.permissions).toContain('CAN_POST');
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      mockUserModel.countDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90)  // active
        .mockResolvedValueOnce(10)  // banned
        .mockResolvedValueOnce(5);  // lowKarma

      const { req, res } = mockReqRes();
      await adminController.getUserStats(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.data.total).toBe(100);
      expect(response.data.active).toBe(90);
      expect(response.data.banned).toBe(10);
      expect(response.data.lowKarma).toBe(5);
    });
  });
});
