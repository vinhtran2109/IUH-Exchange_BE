import crypto from 'crypto';


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
import { publishUserEvent } from '../services/kafka.service.js';
import { applyKarmaAdjustment } from '../services/karma.service.js';
import { DEFAULT_KARMA } from '../services/karma-policy.js';

function escapeRegex(str) {
  if (!str) return '';
  const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped;
}

function mapToProfile(user) {
  if (!user) return null;
  const profile = {
    id: user._id,
    email: user.email,
    name: user.name,
    studentId: user.studentId,
    studentVerification: user.studentVerification || { status: 'UNSUBMITTED' },
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isActive: user.isActive,
    karmaPoint: user.karmaPoint,
    role: user.role,
    permissions: user.permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  return profile;
}

export async function listUsers(req, res) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const { search, role, isActive } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (search) {
      const normalizedSearch = String(search).trim();
      const regex = new RegExp(escapeRegex(normalizedSearch), 'i');
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

    const total = 0;
    const users = [];
    
    const pageResponse = new PageResponse({
      content: users,
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    res.json(ApiResponse.ok(pageResponse));
  } catch (error) {
    logger.error('Error in listUsers:', error);
    throw error;
  }
}

export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['STUDENT', 'MODERATOR', 'ADMIN'];

    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Role không hợp lệ. Phải là: ${validRoles.join(', ')}`);
    }

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    res.json(ApiResponse.ok(mapToProfile(user), 'Cập nhật vai trò thành công'));
  } catch (error) {
    logger.error('Error updating user role:', error);
    throw error;
  }
}

export async function updateUserPermissions(req, res) {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const validPermissions = [
      'CAN_POST',
      'CAN_CHAT',
      'CAN_REPORT',
      'CAN_BAN',
      'CAN_APPROVE_POST',
      'CAN_VIEW_AUDIT',
      'CAN_MANAGE_ORDERS',
      'CAN_RESOLVE_DISPUTES',
      'CAN_MANAGE_SYSTEM',
    ];
    
    const invalid = permissions.filter((p) => !validPermissions.includes(p));
    if (invalid.length > 0) {
      throw new BadRequestException(`Permission không hợp lệ: ${invalid.join(', ')}`);
    }

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    res.json(ApiResponse.ok(mapToProfile(user), 'Cập nhật quyền thành công'));
  } catch (error) {
    logger.error('Error updating permissions:', error);
    throw error;
  }
}

export async function adjustKarma(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    const previousKarma = Number(user?.karmaPoint ?? DEFAULT_KARMA);
    const adjustment = amount || 0;

    res.json(
      ApiResponse.ok(
        { ...mapToProfile(user), previousKarma, adjustment },
        'Cập nhật karma thành công'
      )
    );
  } catch (error) {
    logger.error('Error adjusting karma:', error);
    throw error;
  }
}

export async function toggleBanUser(req, res) {
  try {
    const { id } = req.params;
    const user = null;

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    if (user.isActive) {
      res.json(ApiResponse.ok(mapToProfile(user), 'Đã khóa tài khoản'));
    } else {
      res.json(ApiResponse.ok(mapToProfile(user), 'Đã mở khóa tài khoản'));
    }
  } catch (error) {
    logger.error('Error toggling ban status:', error);
    throw error;
  }
}

export async function banUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    logger.info(`User ban request for ${id}. Reason: ${reason || 'N/A'}`);
    res.json(ApiResponse.ok(mapToProfile(user), 'Đã khóa tài khoản'));
  } catch (error) {
    logger.error('Error banning user:', error);
    throw error;
  }
}

export async function unbanUser(req, res) {
  try {
    const { id } = req.params;
    const user = null;

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    logger.info(`User unban request for ${id}`);
    res.json(ApiResponse.ok(mapToProfile(user), 'Đã mở khóa tài khoản'));
  } catch (error) {
    logger.error('Error unbanning user:', error);
    throw error;
  }
}

export async function getUserStats(req, res) {
  try {
    const total = 0;
    const active = 0;
    const banned = 0;
    const lowKarma = 0;

    res.json(ApiResponse.ok({ total, active, banned, lowKarma }));
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    throw error;
  }
}

export async function getUserDetail(req, res) {
  try {
    const { id } = req.params;
    const user = null;

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    const karmaHistory = [];

    res.json(ApiResponse.ok({
      ...mapToProfile(user),
      recentKarmaHistory: karmaHistory,
    }));
  } catch (error) {
    logger.error('Error fetching user detail:', error);
    throw error;
  }
}

export async function reviewStudentVerification(req, res) {
  try {
    const { id } = req.params;
    const action = String(req.body?.action || '').toUpperCase();
    const adminNote = String(req.body?.adminNote || '').trim();

    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new BadRequestException('action must be APPROVE or REJECT');
    }

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    if (user?.studentVerification?.status !== 'PENDING') {
      throw new BadRequestException('Người dùng không có yêu cầu xác minh MSSV đang chờ');
    }

    logger.info(`Student verification ${action.toLowerCase()}: user=${user?.email}`);
    res.json(ApiResponse.ok(mapToProfile(user), 'Đã cập nhật xác minh MSSV'));
  } catch (error) {
    logger.error('Error reviewing student verification:', error);
    throw error;
  }
}

export async function listAuditLogs(req, res) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const { action, userId, resource, method, statusCode } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (resource) filter.resource = resource;
    if (method) filter.method = String(method).toUpperCase();
    if (statusCode) filter.statusCode = Number(statusCode);

    const logs = [];
    const total = 0;

    const pageResponse = new PageResponse({
      content: logs,
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    res.json(ApiResponse.ok(pageResponse));
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    throw error;
  }
}

export async function deleteUserAccount(req, res) {
  try {
    const { id } = req.params;

    if (req.user?.sub === id) {
      throw new ForbiddenException('Admin cannot delete their own account');
    }

    const user = null;
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    if (user.isDeleted) {
      throw new BadRequestException('Tài khoản đã bị xóa trước đó');
    }

    logger.info(`User delete request: ${id}`);
    res.json(ApiResponse.ok(null, 'Tài khoản đã được xóa thành công'));
  } catch (error) {
    logger.error('Error deleting user account:', error);
    throw error;
  }
}
