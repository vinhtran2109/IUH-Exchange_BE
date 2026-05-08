import jwt from 'jsonwebtoken';
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

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    next();
  };
}
