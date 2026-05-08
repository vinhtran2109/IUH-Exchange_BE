import { User } from '../models/User.js';
import {
  ResourceNotFoundException,
  BadRequestException,
  ApiResponse,
  parsePagination,
  logger,
  cache,
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
