import { User } from '../models/User.js';
import {
  BadRequestException,
  ResourceNotFoundException,
  UnauthorizedException,
  ApiResponse,
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
  compareToken,
  logger,
} from '@iuh-exchange/common';
import crypto from 'crypto';
import { sendOtpEmail, sendPasswordResetOtpEmail } from '../services/email.service.js';

/**
 * Register new user
 */
export async function register(req, res) {
  const { email, password, name, studentId } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new BadRequestException('Email đã được đăng ký');
  }

  const passwordHash = await hashPassword(password);
  const otp = crypto.randomInt(100000, 999999).toString();

  const user = await User.create({
    email,
    passwordHash,
    name,
    studentId: studentId || '',
    otp,
    otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    otpAttemptCount: 0,
  });

  // Bug #8 fix: Don't log OTP plaintext to console/logs
  logger.debug(`OTP sent to: ${email}`);
  await sendOtpEmail(email, otp, name);

  res.status(201).json(
    ApiResponse.created({ email: user.email, name: user.name }, 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận OTP.')
  );
}

/**
 * Verify OTP
 */
export async function verifyOtp(req, res) {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ResourceNotFoundException('User', email);
  if (user.isVerified) throw new BadRequestException('Tài khoản đã được xác nhận');
  if (!user.otp || !user.otpExpiry) throw new BadRequestException('Không tìm thấy OTP. Vui lòng đăng ký lại.');

  if (user.otpExpiry < new Date()) {
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttemptCount = 0;
    await user.save();
    throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
  }

  if (user.otpAttemptCount >= 5) {
    throw new BadRequestException('Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.');
  }

  if (user.otp !== otp) {
    user.otpAttemptCount += 1;
    await user.save();
    const remaining = 5 - user.otpAttemptCount;
    throw new BadRequestException(`OTP không hợp lệ. Còn ${remaining} lần thử.`);
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpAttemptCount = 0;
  await user.save();

  logger.info(`[Auth] Email verified: ${email}`);

  res.json(ApiResponse.ok(null, 'Xác nhận email thành công'));
}

/**
 * Resend OTP
 */
export async function resendOtp(req, res) {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ResourceNotFoundException('User', email);
  if (user.isVerified) throw new BadRequestException('Tài khoản đã được xác nhận');

  const otp = crypto.randomInt(100000, 999999).toString();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  user.otpAttemptCount = 0;
  await user.save();

  // Bug #8 fix: Don't log OTP plaintext
  logger.debug(`Resend OTP sent to: ${email}`);
  await sendOtpEmail(email, otp, user.name);

  res.json(ApiResponse.ok(null, 'Đã gửi lại mã OTP'));
}

/**
 * Login
 */
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
  if (!user.isVerified) throw new BadRequestException('Vui lòng xác nhận email trước');
  if (!user.isActive) throw new BadRequestException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');

  // Check if account is locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMs = user.lockUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new BadRequestException(`Tài khoản tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainingMin} phút.`);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    // Increment failed login attempts
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
      await user.save();
      logger.warn(`[Auth] Account locked due to failed login attempts: ${email}`);
      throw new BadRequestException('Tài khoản tạm khóa 15 phút do nhập sai quá 5 lần. Vui lòng thử lại sau.');
    }

    await user.save();
    const remaining = MAX_ATTEMPTS - user.failedLoginAttempts;
    throw new UnauthorizedException(`Email hoặc mật khẩu không đúng. Còn ${remaining} lần thử.`);
  }

  // Reset failed login attempts on successful login
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }

  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ sub: user._id.toString() });

  user.refreshToken = hashToken(refreshToken);
  await user.save();

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(
    ApiResponse.ok(
      {
        accessToken,
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        karmaPoint: user.karmaPoint,
        studentId: user.studentId,
      },
      'Đăng nhập thành công'
    )
  );
}

/**
 * Refresh token
 */
export async function refreshToken(req, res) {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) throw new UnauthorizedException('Missing refresh token');

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !compareToken(token, user.refreshToken)) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken({ sub: user._id.toString() });

  user.refreshToken = hashToken(newRefreshToken);
  await user.save();

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(ApiResponse.ok({ accessToken }));
}

/**
 * Logout
 */
export async function logout(req, res) {
  const userId = req.user.sub;
  await User.findByIdAndUpdate(userId, { refreshToken: null });

  res.clearCookie('refreshToken', { path: '/' });
  res.json(ApiResponse.ok(null, 'Đăng xuất thành công'));
}

/**
 * Change password (authenticated)
 */
export async function changePassword(req, res) {
  const userId = req.user.sub;
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(userId);
  if (!user) throw new ResourceNotFoundException('User', userId);

  const valid = await comparePassword(oldPassword, user.passwordHash);
  if (!valid) throw new BadRequestException('Mật khẩu hiện tại không chính xác');

  if (oldPassword === newPassword) {
    throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.refreshToken = null;
  await user.save();

  logger.info(`[Auth] Password changed for user: ${user.email}`);

  res.json(ApiResponse.ok(null, 'Đổi mật khẩu thành công'));
}

/**
 * Forgot password - send reset OTP
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ResourceNotFoundException('User', email);
  if (!user.isVerified) throw new BadRequestException('Tài khoản chưa được xác thực');

  const otp = crypto.randomInt(100000, 999999).toString();
  user.passwordResetOtp = otp;
  user.passwordResetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  // Bug #8 fix: Don't log OTP plaintext
  logger.debug(`Password reset OTP sent to: ${email}`);
  await sendPasswordResetOtpEmail(email, otp, user.name);

  res.json(ApiResponse.ok(null, 'Đã gửi mã OTP đặt lại mật khẩu'));
}

/**
 * Reset password with OTP
 */
export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ResourceNotFoundException('User', email);
  if (!user.passwordResetOtp || !user.passwordResetOtpExpiry) {
    throw new BadRequestException('Không tìm thấy yêu cầu đặt lại mật khẩu');
  }
  if (user.passwordResetOtpExpiry < new Date()) {
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiry = undefined;
    await user.save();
    throw new BadRequestException('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
  }
  if (user.passwordResetOtp !== otp) {
    throw new BadRequestException('Mã OTP không hợp lệ');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpiry = undefined;
  user.refreshToken = null;
  await user.save();

  logger.info(`[Auth] Password reset for user: ${user.email}`);

  res.json(ApiResponse.ok(null, 'Đặt lại mật khẩu thành công'));
}
