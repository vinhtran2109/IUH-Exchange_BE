import crypto from 'crypto';
import { User } from '../models/User.js';
import { KarmaHistory } from '../models/KarmaHistory.js';
import {
  ResourceNotFoundException,
  BadRequestException,
  ForbiddenException,
  ApiResponse,
  PageResponse,
  parsePagination,
  logger,
  hashPassword,
  AuditLog,
} from '@iuh-exchange/common';

// Bug #6 fix: Escape special regex chars to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
 * GET /api/v1/admin/users
 * Paginated user list with optional search
 */
export async function listUsers(req, res) {
  const { page, size, skip } = parsePagination(req.query);
  const { search, role, isActive } = req.query;

  const filter = { isDeleted: { $ne: true } };

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { email: regex },
      { name: regex },
      { studentId: regex },
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -refreshToken -otp -otpExpiry -otpAttemptCount -passwordResetOtp -passwordResetOtpExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size),
    User.countDocuments(filter),
  ]);

  const pageResponse = new PageResponse({
    content: users.map(mapToProfile),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}

/**
 * PUT /api/v1/admin/users/:id/role
 */
export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['STUDENT', 'MODERATOR', 'ADMIN'];
  if (!validRoles.includes(role)) {
    throw new BadRequestException(`Role không hợp lệ. Phải là: ${validRoles.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  user.role = role;
  await user.save();

  logger.info(`[Admin] Role updated for ${user.email}: ${role}`);

  res.json(ApiResponse.ok(mapToProfile(user), 'Cập nhật vai trò thành công'));
}

/**
 * PUT /api/v1/admin/users/:id/permissions
 */
export async function updateUserPermissions(req, res) {
  const { id } = req.params;
  const { permissions } = req.body;

  const validPermissions = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT', 'CAN_BAN', 'CAN_APPROVE_POST'];
  const invalid = permissions.filter((p) => !validPermissions.includes(p));
  if (invalid.length > 0) {
    throw new BadRequestException(`Permission không hợp lệ: ${invalid.join(', ')}`);
  }

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  user.permissions = permissions;
  await user.save();

  logger.info(`[Admin] Permissions updated for ${user.email}: [${permissions.join(', ')}]`);

  res.json(ApiResponse.ok(mapToProfile(user), 'Cập nhật quyền thành công'));
}

/**
 * PUT /api/v1/admin/users/:id/karma
 */
export async function adjustKarma(req, res) {
  const { id } = req.params;
  const { amount, reason } = req.body;

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  const previousKarma = user.karmaPoint;
  user.karmaPoint += amount;

  // Auto-revoke CAN_POST when karma drops below 0
  if (user.karmaPoint < 0 && user.permissions.includes('CAN_POST')) {
    user.permissions = user.permissions.filter((p) => p !== 'CAN_POST');
    logger.info(`[Admin] CAN_POST revoked for ${user.email} (karma: ${user.karmaPoint})`);
  }

  // Restore CAN_POST when karma returns to non-negative
  if (user.karmaPoint >= 0 && !user.permissions.includes('CAN_POST')) {
    user.permissions.push('CAN_POST');
    logger.info(`[Admin] CAN_POST restored for ${user.email} (karma: ${user.karmaPoint})`);
  }

  await user.save();

  // Log karma change to history
  await KarmaHistory.create({
    userId: id,
    amount,
    previousKarma,
    newKarma: user.karmaPoint,
    reason: reason || 'Admin adjustment',
    performedBy: req.user?.sub || null,
    source: 'ADMIN',
  });

  logger.info(`[Admin] Karma adjusted for ${user.email}: ${previousKarma} → ${user.karmaPoint} (${amount > 0 ? '+' : ''}${amount}). Reason: ${reason || 'N/A'}`);

  res.json(
    ApiResponse.ok(
      { ...mapToProfile(user), previousKarma, adjustment: amount },
      'Cập nhật karma thành công'
    )
  );
}

/**
 * PATCH /api/v1/users/admin/:id/toggle-ban
 * Toggle user ban status.
 */
export async function toggleBanUser(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  if (user.isActive) {
    // Ban
    user.isActive = false;
    user.permissions = [];
    await user.save();
    logger.info(`[Admin] User banned: ${user.email}`);
    res.json(ApiResponse.ok(mapToProfile(user), 'Đã khóa tài khoản'));
  } else {
    // Unban
    user.isActive = true;
    user.permissions = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'];
    await user.save();
    logger.info(`[Admin] User unbanned: ${user.email}`);
    res.json(ApiResponse.ok(mapToProfile(user), 'Đã mở khóa tài khoản'));
  }
}

/**
 * POST /api/v1/admin/users/:id/ban
 */
export async function banUser(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  user.isActive = false;
  user.permissions = [];
  await user.save();

  logger.info(`[Admin] User banned: ${user.email}. Reason: ${reason || 'N/A'}`);

  res.json(ApiResponse.ok(mapToProfile(user), 'Đã khóa tài khoản'));
}

/**
 * POST /api/v1/admin/users/:id/unban
 */
export async function unbanUser(req, res) {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);

  user.isActive = true;
  user.permissions = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'];
  await user.save();

  logger.info(`[Admin] User unbanned: ${user.email}`);

  res.json(ApiResponse.ok(mapToProfile(user), 'Đã mở khóa tài khoản'));
}

/**
 * GET /api/v1/admin/stats
 */
export async function getUserStats(req, res) {
  const [total, active, banned, lowKarma] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ isDeleted: { $ne: true }, isActive: true }),
    User.countDocuments({ isDeleted: { $ne: true }, isActive: false }),
    User.countDocuments({ isDeleted: { $ne: true }, karmaPoint: { $lt: 0 } }),
  ]);

  res.json(ApiResponse.ok({ total, active, banned, lowKarma }));
}

/**
 * GET /api/v1/admin/users/:id/detail
 * Get detailed user info (admin only).
 */
export async function getUserDetail(req, res) {
  const { id } = req.params;

  const user = await User.findById(id)
    .select('-passwordHash -refreshToken -otp -otpExpiry -otpAttemptCount -passwordResetOtp -passwordResetOtpExpiry')
    .lean();

  if (!user) throw new ResourceNotFoundException('User', id);

  const karmaHistory = await KarmaHistory.find({ userId: id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json(ApiResponse.ok({
    ...mapToProfile(user),
    recentKarmaHistory: karmaHistory,
  }));
}

/**
 * GET /api/v1/users/admin/audit-logs
 * Search audit log entries for admin operations and security review.
 */
export async function listAuditLogs(req, res) {
  const { page, size, skip } = parsePagination(req.query);
  const { action, userId, resource, method, statusCode } = req.query;
  const filter = {};

  if (action) filter.action = action;
  if (userId) filter.userId = userId;
  if (resource) filter.resource = resource;
  if (method) filter.method = String(method).toUpperCase();
  if (statusCode) filter.statusCode = Number(statusCode);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
    AuditLog.countDocuments(filter),
  ]);

  const pageResponse = new PageResponse({
    content: logs,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}

/**
 * DELETE /api/v1/users/admin/:id
 * Soft-delete a user account as admin.
 */
export async function deleteUserAccount(req, res) {
  const { id } = req.params;

  if (req.user?.sub === id) {
    throw new ForbiddenException('Admin cannot delete their own account');
  }

  const user = await User.findById(id);
  if (!user) throw new ResourceNotFoundException('User', id);
  if (user.isDeleted) throw new BadRequestException('Tài khoản đã bị xóa trước đó');

  const anonymizedEmail = `deleted_${id.substring(0, 8)}@deleted.iuh.edu.vn`;
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
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpAttemptCount = 0;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpiry = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  await user.save();

  logger.info(`[Admin] User deleted: ${id}`);

  res.json(ApiResponse.ok(null, 'Tài khoản đã được xóa thành công'));
}
