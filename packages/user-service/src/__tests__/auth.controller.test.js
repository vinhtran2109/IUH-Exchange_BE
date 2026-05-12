import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockUserInstance = {
  _id: 'user123',
  email: 'test@student.iuh.edu.vn',
  name: 'Test User',
  studentId: 'DH123456',
  passwordHash: '',
  isVerified: false,
  isActive: true,
  karmaPoint: 100,
  role: 'STUDENT',
  permissions: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
  otp: null,
  otpExpiry: null,
  otpAttemptCount: 0,
  refreshToken: null,
  passwordResetOtp: null,
  passwordResetOtpExpiry: null,
  save: vi.fn(),
  toObject: vi.fn().mockReturnThis(),
};

const mockUser = {
  findOne: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  create: vi.fn(),
};

vi.mock('../models/User.js', () => ({
  User: mockUser,
}));

vi.mock('../services/email.service.js', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetOtpEmail: vi.fn().mockResolvedValue(true),
}));

// Mock common module - provide all used exports
vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  };
});

// We need to import after mocking
const auth = await import('../controllers/auth.controller.js');
const { User } = await import('../models/User.js');
const bcrypt = await import('bcrypt');
const crypto = await import('crypto');

// Helper to create mock req/res
function mockReqRes(body = {}, headers = {}, cookies = {}) {
  const req = {
    body,
    headers,
    cookies,
    user: { sub: 'user123', email: 'test@student.iuh.edu.vn', role: 'STUDENT', permissions: [] },
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('auth.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue({
        ...mockUserInstance,
        email: 'newuser@student.iuh.edu.vn',
        name: 'New User',
      });

      const { req, res } = mockReqRes({
        email: 'newuser@student.iuh.edu.vn',
        password: 'Password123!',
        name: 'New User',
        studentId: 'DH999999',
      });

      await auth.register(req, res);

      expect(User.findOne).toHaveBeenCalled();
      expect(User.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      User.findOne.mockResolvedValue(mockUserInstance);

      const { req, res } = mockReqRes({
        email: 'existing@student.iuh.edu.vn',
        password: 'Password123!',
        name: 'Test',
      });

      await expect(auth.register(req, res)).rejects.toThrow('Email đã được đăng ký');
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const user = {
        ...mockUserInstance,
        otp: '123456',
        otpExpiry: new Date(Date.now() + 600000),
        otpAttemptCount: 0,
        isVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', otp: '123456' });
      await auth.verifyOtp(req, res);

      expect(user.isVerified).toBe(true);
      expect(user.otp).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
    });

    it('should reject expired OTP', async () => {
      const user = {
        ...mockUserInstance,
        otp: '123456',
        otpExpiry: new Date(Date.now() - 1000), // Expired
        otpAttemptCount: 0,
        isVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', otp: '123456' });
      await expect(auth.verifyOtp(req, res)).rejects.toThrow('OTP đã hết hạn');
    });

    it('should reject after too many attempts', async () => {
      const user = {
        ...mockUserInstance,
        otp: '123456',
        otpExpiry: new Date(Date.now() + 600000),
        otpAttemptCount: 5,
        isVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', otp: '999999' });
      await expect(auth.verifyOtp(req, res)).rejects.toThrow('nhập sai quá nhiều lần');
    });

    it('should increment attempt count on wrong OTP', async () => {
      const user = {
        ...mockUserInstance,
        otp: '123456',
        otpExpiry: new Date(Date.now() + 600000),
        otpAttemptCount: 2,
        isVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', otp: '999999' });
      await expect(auth.verifyOtp(req, res)).rejects.toThrow('OTP không hợp lệ');
      expect(user.otpAttemptCount).toBe(3);
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await auth.login(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword!', 10);
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
      });

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'WrongPassword!' });
      await expect(auth.login(req, res)).rejects.toThrow('Email hoặc mật khẩu không đúng');
    });

    it('should reject unverified user', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: false,
        isActive: true,
      });

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await expect(auth.login(req, res)).rejects.toThrow('Vui lòng xác nhận email');
    });

    it('should reject inactive (banned) user', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: false,
      });

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await expect(auth.login(req, res)).rejects.toThrow('Tài khoản của bạn đã bị khóa');
    });

    it('should reject login when account is locked', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lockUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more minutes
      });

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await expect(auth.login(req, res)).rejects.toThrow('tạm khóa');
    });

    it('should track failed login attempts and lock after 5 failures', async () => {
      const hash = await bcrypt.hash('CorrectPassword!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 4, // 4 previous failures
        lockUntil: null,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'WrongPassword!' });
      await expect(auth.login(req, res)).rejects.toThrow('tạm khóa 15 phút');
      expect(user.lockUntil).toBeDefined();
      expect(user.lockUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('should show remaining attempts on wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 1,
        lockUntil: null,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'WrongPassword!' });
      await expect(auth.login(req, res)).rejects.toThrow('Còn 3 lần thử');
    });

    it('should reset failed attempts on successful login', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 3,
        lockUntil: null,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await auth.login(req, res);

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockUntil).toBeNull();
      expect(user.save).toHaveBeenCalled();
    });

    it('should allow login after lock period expires', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        isVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lockUntil: new Date(Date.now() - 1000), // lock expired 1 second ago
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn', password: 'Password123!' });
      await auth.login(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.accessToken).toBeDefined();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hash = await bcrypt.hash('OldPassword!', 10);
      const user = {
        ...mockUserInstance,
        passwordHash: hash,
        save: vi.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(user);

      const { req, res } = mockReqRes({ oldPassword: 'OldPassword!', newPassword: 'NewPassword!' });
      req.user = { sub: 'user123' };
      await auth.changePassword(req, res);

      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should reject wrong old password', async () => {
      const hash = await bcrypt.hash('OldPassword!', 10);
      User.findById.mockResolvedValue({ ...mockUserInstance, passwordHash: hash });

      const { req, res } = mockReqRes({ oldPassword: 'WrongOld!', newPassword: 'NewPassword!' });
      req.user = { sub: 'user123' };
      await expect(auth.changePassword(req, res)).rejects.toThrow('Mật khẩu hiện tại không chính xác');
    });

    it('should reject same old and new password', async () => {
      const hash = await bcrypt.hash('SamePassword!', 10);
      User.findById.mockResolvedValue({ ...mockUserInstance, passwordHash: hash });

      const { req, res } = mockReqRes({ oldPassword: 'SamePassword!', newPassword: 'SamePassword!' });
      req.user = { sub: 'user123' };
      await expect(auth.changePassword(req, res)).rejects.toThrow('không được trùng');
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('should send reset OTP', async () => {
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        isVerified: true,
        save: vi.fn().mockResolvedValue(true),
      });

      const { req, res } = mockReqRes({ email: 'test@student.iuh.edu.vn' });
      await auth.forgotPassword(req, res);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reset password with valid OTP', async () => {
      const user = {
        ...mockUserInstance,
        passwordResetOtp: '654321',
        passwordResetOtpExpiry: new Date(Date.now() + 600000),
        save: vi.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);

      const { req, res } = mockReqRes({
        email: 'test@student.iuh.edu.vn',
        otp: '654321',
        newPassword: 'NewPass123!',
      });
      await auth.resetPassword(req, res);

      expect(user.passwordResetOtp).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
    });

    it('should reject invalid reset OTP', async () => {
      User.findOne.mockResolvedValue({
        ...mockUserInstance,
        passwordResetOtp: '654321',
        passwordResetOtpExpiry: new Date(Date.now() + 600000),
      });

      const { req, res } = mockReqRes({
        email: 'test@student.iuh.edu.vn',
        otp: '999999',
        newPassword: 'NewPass123!',
      });
      await expect(auth.resetPassword(req, res)).rejects.toThrow('Mã OTP không hợp lệ');
    });
  });

  describe('logout', () => {
    it('should clear refresh token and cookie', async () => {
      User.findByIdAndUpdate.mockResolvedValue(true);

      const { req, res } = mockReqRes();
      req.user = { sub: 'user123' };
      await auth.logout(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', { refreshToken: null });
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ path: '/' }));
    });
  });
});
