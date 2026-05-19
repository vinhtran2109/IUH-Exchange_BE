import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
vi.mock('../models/User.js', () => {
  const mockUser = {
    _id: 'user-123',
    email: 'test@iuh.edu.vn',
    name: 'Nguyễn Văn A',
    studentId: '21001234',
    studentVerification: { status: 'UNSUBMITTED' },
    avatarUrl: '',
    bankInfo: {},
    isVerified: false,
    isActive: true,
    karmaPoint: 100,
    role: 'STUDENT',
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(true),
  };

  const mockFindById = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue(mockUser),
  });
  const mockFindOne = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
    lean: vi.fn().mockResolvedValue(null),
  });

  return {
    User: {
      findById: mockFindById,
      findOne: mockFindOne,
    },
    __mockUser: mockUser,
    __mockFindById: mockFindById,
    __mockFindOne: mockFindOne,
  };
});

vi.mock('../services/s3.service.js', () => ({
  getAvatarUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://s3.amazonaws.com/upload',
    publicUrl: 'https://s3.amazonaws.com/avatar.jpg',
  }),
}));

vi.mock('../services/kafka.service.js', () => ({
  publishUserEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
    },
  };
});

import {
  getMyProfile,
  getUserProfile,
  getUserByStudentId,
  getAvatarPresign,
} from '../controllers/user.controller.js';
import { User, __mockUser as mockUser, __mockFindById as mockFindById, __mockFindOne as mockFindOne } from '../models/User.js';
import { cache } from '@iuh-exchange/common';

describe('user.controller', () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: {},
      query: {},
      user: { sub: 'user-123' },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    // Reset defaults
    mockFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });
    mockFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
      lean: vi.fn().mockResolvedValue(null),
    });
  });

  describe('getMyProfile', () => {
    it('should return current user profile', async () => {
      await getMyProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'user-123',
            email: 'test@iuh.edu.vn',
            name: 'Nguyễn Văn A',
          }),
        })
      );
    });

    it('should throw if user not found', async () => {
      mockFindById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await expect(getMyProfile(req, res)).rejects.toThrow();
    });
  });

  describe('getUserProfile', () => {
    it('should return cached profile if available', async () => {
      req.params.id = 'user-123';
      const cachedResponse = { success: true, data: { id: 'user-123', cached: true } };
      cache.get.mockResolvedValueOnce(cachedResponse);

      await getUserProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(cachedResponse);
    });

    it('should fetch from DB and cache on cache miss', async () => {
      req.params.id = 'user-123';

      await getUserProfile(req, res);

      expect(cache.set).toHaveBeenCalledWith(
        'users:profile:user-123',
        expect.any(Object),
        600
      );
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getUserByStudentId', () => {
    it('should return user by studentId', async () => {
      req.params.studentId = '21001234';
      mockFindOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          _id: 'user-123',
          name: 'Nguyễn Văn A',
          email: 'test@iuh.edu.vn',
          studentId: '21001234',
          karmaPoint: 100,
          role: 'STUDENT',
          isVerified: false,
          createdAt: new Date(),
        }),
      });

      await getUserByStudentId(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            studentId: '21001234',
          }),
        })
      );
    });

    it('should throw for invalid studentId format', async () => {
      req.params.studentId = 'abc';

      await expect(getUserByStudentId(req, res)).rejects.toThrow('Invalid studentId format');
    });

    it('should throw for too short studentId', async () => {
      req.params.studentId = '1234567'; // 7 digits, min is 8

      await expect(getUserByStudentId(req, res)).rejects.toThrow('Invalid studentId format');
    });

    it('should return cached result if available', async () => {
      req.params.studentId = '21001234';
      const cachedResponse = { success: true, data: { id: 'user-123' } };
      cache.get.mockResolvedValueOnce(cachedResponse);

      await getUserByStudentId(req, res);

      expect(res.json).toHaveBeenCalledWith(cachedResponse);
    });

    it('should throw if user not found by studentId', async () => {
      req.params.studentId = '21009999';
      mockFindOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(null),
      });

      await expect(getUserByStudentId(req, res)).rejects.toThrow();
    });
  });

  describe('getAvatarPresign', () => {
    it('should return presigned URL for valid content type', async () => {
      req.body = { contentType: 'image/jpeg' };

      await getAvatarPresign(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            uploadUrl: expect.any(String),
            publicUrl: expect.any(String),
          }),
        })
      );
    });

    it('should throw for non-image content type', async () => {
      req.body = { contentType: 'application/pdf' };

      await expect(getAvatarPresign(req, res)).rejects.toThrow('contentType phải là image/*');
    });
  });
});
