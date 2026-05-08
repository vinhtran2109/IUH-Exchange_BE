import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

/**
 * Map HTTP method + path to a human-readable action.
 */
function inferAction(method, path) {
  const normalized = path.replace(/\/[a-f0-9]{24}/gi, '/:id').replace(/\/+$/, '');

  if (method === 'POST' && normalized.includes('login')) return 'USER_LOGIN';
  if (method === 'POST' && normalized.includes('register')) return 'USER_REGISTER';
  if (method === 'POST' && normalized.includes('logout')) return 'USER_LOGOUT';
  if (method === 'PUT' && normalized.includes('change-password')) return 'PASSWORD_CHANGE';
  if (method === 'POST' && normalized.includes('reset-password')) return 'PASSWORD_RESET';

  if (method === 'POST') return 'CREATE';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  if (method === 'GET') return 'READ';

  return `${method}_${normalized}`;
}

/**
 * Infer the resource type from the path.
 */
function inferResource(path) {
  const parts = path.replace(/^\//, '').split('/');
  // Skip 'api', 'v1', version prefixes
  for (const part of parts) {
    if (!part.match(/^(api|v1|v\d+)$/)) {
      return part.replace(/s$/, ''); // crude singularize
    }
  }
  return 'unknown';
}

/**
 * Audit logging middleware.
 * Logs sensitive operations (mutations) to the AuditLog collection.
 * GET requests are skipped by default unless explicitly included.
 *
 * @param {object} [options]
 * @param {boolean} [options.logReads=false] - Whether to log GET requests
 */
export function auditLog(options = {}) {
  const { logReads = false } = options;

  return (req, res, next) => {
    // Skip GET requests unless logReads is enabled
    if (!logReads && req.method === 'GET') {
      return next();
    }

    // Capture original res.json to intercept response
    const originalJson = res.json.bind(res);
    let responseBody = null;

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    // Log after response is sent
    res.on('finish', async () => {
      try {
        const action = inferAction(req.method, req.originalUrl || req.path);
        const resource = inferResource(req.originalUrl || req.path);

        // Extract resource ID from URL params
        const resourceId = req.params?.id || req.params?.orderId || req.params?.productId || null;

        await AuditLog.create({
          userId: req.user?.sub || req.headers['x-user-id'] || null,
          action,
          resource,
          resourceId,
          method: req.method,
          path: req.originalUrl || req.path,
          ip: req.ip || req.headers['x-forwarded-for'] || null,
          userAgent: req.headers['user-agent'] || null,
          statusCode: res.statusCode,
          metadata: {
            query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
            params: Object.keys(req.params || {}).length > 0 ? req.params : undefined,
          },
        });
      } catch (err) {
        // Don't let audit logging failures break the request
        logger.warn(`Audit log failed: ${err.message}`);
      }
    });

    next();
  };
}
