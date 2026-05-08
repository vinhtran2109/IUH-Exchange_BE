/**
 * JWT Auth Filter — validates Bearer tokens and injects identity headers.
 *
 * Mirrors the Spring Boot JwtAuthSafeGatewayFilterFactory:
 *   - Decodes JWT from Authorization: Bearer <token>
 *   - Injects X-User-Id, X-User-Role, X-User-Email into the proxied request
 *   - Returns 401 for invalid/missing tokens on protected routes
 *
 * Usage:
 *   app.use('/api/v1/users', authFilter, proxy);
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '@iuh-exchange/common';

/**
 * Create an auth filter middleware for protected routes.
 * Validates JWT and sets identity headers, or rejects with 401.
 */
export function authFilter(req, res, next) {
  // OPTIONS always passes (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Missing or invalid Authorization header',
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    const userId = decoded.sub || decoded.userId || decoded.id || '';
    const role = decoded.role || 'GUEST';
    const email = decoded.email || '';

    // Inject identity headers for downstream services
    req.headers['x-user-id'] = String(userId);
    req.headers['x-user-role'] = role;
    req.headers['x-user-email'] = email;

    // Compute HMAC signature to prevent header spoofing
    const payload = `${userId}:${role}:${email}`;
    const signature = crypto.createHmac('sha256', config.gatewaySecret || config.jwt.secret).update(payload).digest('hex');
    req.headers['x-gateway-signature'] = signature;

    // Attach to req for logging
    req.user = { id: userId, role, email };

    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token has expired'
        : 'Invalid token';

    return res.status(401).json({
      success: false,
      statusCode: 401,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Optional auth — decodes token if present but never rejects.
 * Useful for public routes where user identity is nice-to-have.
 */
export function optionalAuthFilter(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), config.jwt.secret);
      const userId = decoded.sub || decoded.userId || decoded.id || '';
      const role = decoded.role || 'GUEST';
      const email = decoded.email || '';

      req.headers['x-user-id'] = String(userId);
      req.headers['x-user-role'] = role;
      req.headers['x-user-email'] = email;

      // Compute HMAC signature to prevent header spoofing
      const payload = `${userId}:${role}:${email}`;
      const signature = crypto.createHmac('sha256', config.gatewaySecret || config.jwt.secret).update(payload).digest('hex');
      req.headers['x-gateway-signature'] = signature;

      req.user = { id: userId, role, email };
    } catch {
      // Token invalid — proceed without identity
    }
  }

  next();
}
