import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UnauthorizedException, ForbiddenException } from '../exceptions/index.js';
import { config } from '../config/index.js';

/**
 * JWT Authentication middleware.
 * Giải mã token từ Authorization header và gắn user vào req.user.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    throw new UnauthorizedException('Invalid or expired token');
  }
}

/**
 * Optional authentication - không throw nếu không có token.
 * Dùng cho các endpoint public nhưng cần biết user nếu đã login.
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      req.user = jwt.verify(token, config.jwt.secret);
    } catch {
      // ignore invalid token
    }
  }
  next();
}

/**
 * Verify that X-User-* headers were set by the API gateway (not spoofed).
 * Reads x-user-id, x-user-role, x-user-email, x-gateway-signature from headers.
 * If GATEWAY_SECRET is configured and signature is missing/invalid, returns 403.
 * If valid, sets req.user = { sub, role, email }.
 */
export function verifyGatewaySignature(req, res, next) {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  const email = req.headers['x-user-email'];
  const signature = req.headers['x-gateway-signature'];

  const secret = config.gatewaySecret || config.jwt.secret;

  // If a gateway secret is configured, signature is required
  if (config.gatewaySecret) {
    if (!signature) {
      throw new ForbiddenException('Missing gateway signature');
    }

    // Bug #28 fix: Reject empty userId to prevent bypass
    if (!userId || userId.trim() === '') {
      throw new ForbiddenException('Missing user identity in gateway headers');
    }

    const payload = `${userId}:${role}:${email}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (signature !== expected) {
      throw new ForbiddenException('Invalid gateway signature');
    }
  }

  // Set req.user from verified headers
  req.user = {
    sub: userId || '',
    role: role || 'GUEST',
    email: email || '',
  };

  next();
}

/**
 * Authorization middleware - kiểm tra permissions.
 * Phải dùng sau authenticate().
 *
 * @param  {...string} requiredPermissions - Danh sách permissions cần có
 */
export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasPermission) {
      const permissionLabels = {
        CAN_POST: 'đăng bài',
        CAN_CHAT: 'chat',
        CAN_REPORT: 'báo cáo',
      };
      const missing = requiredPermissions
        .filter((p) => !userPermissions.includes(p))
        .map((p) => permissionLabels[p] || p)
        .join(', ');
      throw new ForbiddenException(`Tài khoản của bạn chưa có quyền ${missing}. Vui lòng kiểm tra điểm karma hoặc liên hệ admin.`);
    }

    next();
  };
}
