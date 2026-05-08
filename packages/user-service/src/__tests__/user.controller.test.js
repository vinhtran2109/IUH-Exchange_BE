import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
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
};

const mockUserModel = {
  findById: vi.fn(),
};

vi.mock('../models/User.js', () => ({ User: mockUserModel }));

vi.mock('../services/s3.service.js', () => ({
  getAvatarUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://s3.amazonaws.com/avatar-upload',
    publicUrl: 'https://s3.amazonaws.com/avatar.jpg',
  }),
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
    },
  };
});

const userController = await import('../controllers/user.controller.js');

function mockReqRes(body = {}, params = {}, user = { sub: 'user123' }) {
  const req = { body, params, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('user.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('should return current user profile', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({ ...mockUser }),
      });

      const { req, res } = mockReqRes();
      await userController.getMyProfile(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.email).toBe('test@student.iuh.edu.vn');
    });

    it('should throw 404 if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const { req, res } = mockReqRes();
      await expect(userController.getMyProfile(req, res)).rejects.toThrow();
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile by ID', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({ ...mockUser }),
      });

      const { req, res } = mockReqRes({}, { id: 'user123' });
      await userController.getUserProfile(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update name and avatarUrl', async () => {
      mockUserModel.findById.mockResolvedValue({
        ...mockUser,
        save: vi.fn().mockResolvedValue(true),
      });

      const { req, res } = mockReqRes({ name: 'Updated Name', avatarUrl: 'https://s3.amazonaws.com/new-avatar.jpg' });
      await userController.updateProfile(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getAvatarPresign', () => {
    it('should generate presigned URL for avatar upload', async () => {
      const { req, res } = mockReqRes({ contentType: 'image/jpeg' });
      await userController.getAvatarPresign(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.data.uploadUrl).toBeDefined();
      expect(response.data.publicUrl).toBeDefined();
    });

    it('should reject non-image contentType', async () => {
      const { req, res } = mockReqRes({ contentType: 'application/pdf' });
      await expect(userController.getAvatarPresign(req, res)).rejects.toThrow('contentType phải là image/*');
    });

    it('should reject missing contentType', async () => {
      const { req, res } = mockReqRes({});
      await expect(userController.getAvatarPresign(req, res)).rejects.toThrow();
    });
  });
});
