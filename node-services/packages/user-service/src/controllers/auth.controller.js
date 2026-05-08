import { User } from '../models/User.js';
import {
  BadRequestException,
  ResourceNotFoundException,
  UnauthorizedException,
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  logger,
} from '@iuh-exchange/common';
import crypto from 'crypto';

/**
 * Register new user
 */
export async function register(req, res) {
  const { email, password, name } = req.body;

  // Check existing user
  const existing = await User.findOne({ email });
  if (existing) {
    throw new BadRequestException('Email đã được đăng ký');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  const user = await User.create({
    email,
    passwordHash,
    name,
    otp,
    otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  // TODO: Send OTP via email (nodemailer/SendGrid)
  logger.info(`OTP for ${email}: ${otp}`);

  res.status(201).json({
    success: true,
    statusCode: 201,
    message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận OTP.',
    data: { email: user.email, name: user.name },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Verify OTP
 */
export async function verifyOtp(req, res) {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ResourceNotFoundException('User', email);
  if (user.isVerified) throw new BadRequestException('Tài khoản đã được xác nhận');
  if (user.otp !== otp || user.otpExpiry < new Date()) {
    throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  res.json({
    success: true,
    statusCode: 200,
    message: 'Xác nhận email thành công',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Login
 */
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
  if (!user.isVerified) throw new BadRequestException('Vui lòng xác nhận email trước');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ sub: user._id.toString() });

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Set refresh token in HttpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    statusCode: 200,
    message: 'Đăng nhập thành công',
    data: {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        karmaPoint: user.karmaPoint,
      },
    },
    timestamp: new Date().toISOString(),
  });
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
  if (!user || user.refreshToken !== token) {
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

  user.refreshToken = newRefreshToken;
  await user.save();

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    statusCode: 200,
    data: { accessToken },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logout
 */
export async function logout(req, res) {
  const userId = req.user.sub;
  await User.findByIdAndUpdate(userId, { refreshToken: null });

  res.clearCookie('refreshToken');
  res.json({
    success: true,
    statusCode: 200,
    message: 'Đăng xuất thành công',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get current user profile
 */
export async function getProfile(req, res) {
  const user = await User.findById(req.user.sub).select('-passwordHash -refreshToken -otp -otpExpiry');
  if (!user) throw new ResourceNotFoundException('User', req.user.sub);

  res.json({
    success: true,
    statusCode: 200,
    data: user,
    timestamp: new Date().toISOString(),
  });
}
