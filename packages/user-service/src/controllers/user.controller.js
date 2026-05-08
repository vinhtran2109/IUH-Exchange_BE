import crypto from 'crypto';
import { User } from '../models/User.js';
import {
  ResourceNotFoundException,
  BadRequestException,
  ApiResponse,
  parsePagination,
  logger,
  cache,
  hashPassword,
} from '@iuh-exchange/common';
import { getAvatarUploadUrl } from '../services/s3.service.js';

function mapToProfile(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    studentId: user.studentId,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isActive: user.isActive,
    karmaPoint: user.karmaPoint,
    role: user.role,
    permissions: user.permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/v1/users/me
 */
export async function getMyProfile(req, res) {
  const user = await User.findById(req.user.sub).select('-passwordHash -refreshToken -otp -otpExpiry -otpAttemptCount -passwordResetOtp -passwordResetOtpExpiry');
  if (!user) throw new ResourceNotFoundException('User', req.user.sub);

  res.json(ApiResponse.ok(mapToProfile(user)));
}

/**
 * GET /api/v1/users/:id
 */
export async function getUserProfile(req, res) {
  const cacheKey = `users:profile:${req.params.id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const user = await User.findById(req.params.id).select('name email studentId avatarUrl karmaPoint role isVerified createdAt');
  if (!user) throw new ResourceNotFoundException('User', req.params.id);

  const response = ApiResponse.ok(mapToProfile(user));
  await cache.set(cacheKey, response, 600); // Cache 10 minutes
  res.json(response);
}

/**
 * PUT /api/v1/users/profile
 */
export async function updateProfile(req, res) {
  const userId = req.user.sub;
  const { name, avatarUrl } = req.body;

  const user = await User.findById(userId);
  if (!user) throw new ResourceNotFoundException('User', userId);

  if (name !== undefined) user.name = name;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();

  logger.info(`[User] Profile updated for user: ${user.email}`);

  // Invalidate user profile cache
  await cache.del(`users:profile:${userId}`);

  res.json(ApiResponse.ok(mapToProfile(user), 'Cập nhật hồ sơ thành công'));
}

/**
 * POST /api/v1/users/avatar/presign
 * Tạo presigned URL để client upload avatar trực tiếp lên S3
 */
export async function getAvatarPresign(req, res) {
  const userId = req.user.sub;
  const { contentType } = req.body;

  if (!contentType || !contentType.startsWith('image/')) {
    throw new BadRequestException('contentType phải là image/*');
  }

  const { uploadUrl, publicUrl } = await getAvatarUploadUrl(userId, contentType);

  res.json(ApiResponse.ok({ uploadUrl, publicUrl }, 'Tạo URL upload thành công'));
}

/**
 * DELETE /api/v1/users/me
 * Soft-delete the authenticated user's account.
 * Anonymizes personal data and marks account as deleted.
 */
export async function deleteAccount(req, res) {
  const userId = req.user.sub;

  const user = await User.findById(userId);
  if (!user) throw new ResourceNotFoundException('User', userId);
  if (user.isDeleted) throw new BadRequestException('Tài khoản đã bị xóa trước đó');

  // Anonymize personal data
  const anonymizedEmail = `deleted_${userId.substring(0, 8)}@deleted.iuh.edu.vn`;
  user.email = anonymizedEmail;
  user.name = 'Tài khoản đã xóa';
  user.studentId = '';
  user.avatarUrl = '';
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.isActive = false;
  user.refreshToken = null;
  user.permissions = [];
  user.passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

  await user.save();

  // Invalidate cache
  await cache.del(`users:profile:${userId}`);

  logger.info(`[User] Account soft-deleted: userId=${userId}`);

  res.json(ApiResponse.ok(null, 'Tài khoản đã được xóa thành công'));
}
