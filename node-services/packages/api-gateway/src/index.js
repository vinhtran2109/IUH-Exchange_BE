/**
 * IUH Exchange — API Gateway
 *
 * Single entry point for the entire microservice cluster.
 * Handles: routing, JWT auth, rate limiting, circuit breaking,
 * request logging, CORS, security headers, WebSocket proxying,
 * health checks, and graceful shutdown.
 *
 * Port: GATEWAY_PORT env var or 8080
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'node:crypto';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import {
  config,
  logger,
  errorHandler,
  getRedis,
} from '@iuh-exchange/common';
import { SERVICES, routes } from './config/routes.js';
import { authFilter, optionalAuthFilter } from './middleware/auth-filter.js';
import { createCircuitBreaker } from './middleware/circuit-breaker.js';
import { correlationId, requestLogger } from './middleware/request-logger.js';

// ────────────────────────────────────────────────────────
// Express app + HTTP server (needed for WebSocket upgrade)
// ────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10);

// ────────────────────────────────────────────────────────
// Security
// ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Let downstream services handle CSP
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Requested-With'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 3600,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ────────────────────────────────────────────────────────
// Correlation ID + Request logging
// ────────────────────────────────────────────────────────
app.use(correlationId);
app.use(requestLogger);

// ────────────────────────────────────────────────────────
// Rate Limiting (Redis-backed)
// ────────────────────────────────────────────────────────
const redis = getRedis();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:global:',
  }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
});

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests for this operation. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:sensitive:',
  }),
});

const limiters = {
  global: globalLimiter,
  auth: authLimiter,
  sensitive: sensitiveLimiter,
};

// ────────────────────────────────────────────────────────
// Circuit Breakers (one per downstream service)
// ────────────────────────────────────────────────────────
const breakers = {};
for (const name of Object.keys(SERVICES)) {
  breakers[name] = createCircuitBreaker(name, {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    halfOpenMax: 1,
  });
}

// ────────────────────────────────────────────────────────
// Proxy factory with circuit breaker + correlation ID
// ────────────────────────────────────────────────────────
function createServiceProxy(serviceName) {
  const target = SERVICES[serviceName];
  const breaker = breakers[serviceName];

  return [
    // Circuit breaker gate
    (req, res, next) => {
      if (breaker.isRejected()) {
        logger.warn(`[${req.requestId}] Circuit OPEN for ${serviceName}`);
        return res.status(503).json({
          success: false,
          statusCode: 503,
          message: `Service '${serviceName}' is temporarily unavailable. Please try again later.`,
          timestamp: new Date().toISOString(),
        });
      }
      next();
    },

    // HTTP proxy
    createProxyMiddleware({
      target,
      changeOrigin: true,
      timeout: 30_000,
      proxyTimeout: 30_000,
      on: {
        proxyReq(proxyReq, req) {
          // Forward correlation ID
          proxyReq.setHeader('X-Request-ID', req.requestId);
        },
        proxyRes(proxyRes, req) {
          const status = proxyRes.statusCode;
          if (status >= 500) {
            breaker.onFailure();
            logger.warn(`[${req.requestId}] Upstream ${serviceName} returned ${status}`);
          } else {
            breaker.onSuccess();
          }
        },
        error(err, req, res) {
          breaker.onFailure();
          logger.error(`[${req.requestId}] Proxy error ${serviceName}: ${err.message}`);
          if (!res.headersSent) {
            res.status(502).json({
              success: false,
              statusCode: 502,
              message: 'Upstream service unavailable. Please try again later.',
              timestamp: new Date().toISOString(),
            });
          }
        },
      },
    }),
  ];
}

// ────────────────────────────────────────────────────────
// Health Check — pings all downstream services
// ────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const serviceStates = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    const breakerState = breakers[name].getState();
    let reachable = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      reachable = resp.ok;
    } catch {
      reachable = false;
    }
    serviceStates[name] = { ...breakerState, reachable };
  }

  const allReachable = Object.values(serviceStates).every(s => s.reachable);

  res.status(allReachable ? 200 : 503).json({
    status: allReachable ? 'ok' : 'degraded',
    service: 'api-gateway',
    uptime: process.uptime(),
    services: serviceStates,
    timestamp: new Date().toISOString(),
  });
});

// ────────────────────────────────────────────────────────
// Mount Routes
// ────────────────────────────────────────────────────────
for (const route of routes) {
  const { path, service, public: isPublic, rateLimiter: limiterKey, methods } = route;
  const middlewares = [];

  // Rate limiter
  if (limiterKey && limiters[limiterKey]) {
    middlewares.push(limiters[limiterKey]);
  }

  // Auth filter
  if (isPublic) {
    middlewares.push(optionalAuthFilter);
  } else {
    middlewares.push(authFilter);
  }

  // Method restriction for public routes with limited methods
  if (methods && methods.length > 0) {
    const allowed = new Set(methods.map(m => m.toUpperCase()));
    middlewares.push((req, res, next) => {
      if (!allowed.has(req.method.toUpperCase())) {
        // Not an allowed method for this public route — check if it needs auth
        // This is a public route with restricted methods, so non-GET needs auth
        return authFilter(req, res, next);
      }
      next();
    });
  }

  // Proxy
  middlewares.push(...createServiceProxy(service));

  app.use(path, ...middlewares);
}

// ────────────────────────────────────────────────────────
// Catch-all 404 for /api/v1
// ────────────────────────────────────────────────────────
app.use('/api/v1', (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// ────────────────────────────────────────────────────────
// Global error handler
// ────────────────────────────────────────────────────────
app.use(errorHandler);

// ────────────────────────────────────────────────────────
// WebSocket Proxy — Socket.IO for chat & notification
// ────────────────────────────────────────────────────────
const WS_SERVICES = [
  { path: '/ws/chat', target: SERVICES.chat },
  { path: '/ws/notifications', target: SERVICES.notification },
];

server.on('upgrade', (req, socket, head) => {
  const { url } = req;

  for (const wsRoute of WS_SERVICES) {
    if (url.startsWith(wsRoute.path)) {
      // Auth check for WebSocket: extract token from query or header
      const urlObj = new URL(url, 'http://localhost');
      const token = urlObj.searchParams.get('token')
        || (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7)
          : null);

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Validate token
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.headers['x-user-id'] = String(decoded.sub || decoded.userId || decoded.id || '');
        req.headers['x-user-role'] = decoded.role || 'GUEST';
        req.headers['x-user-email'] = decoded.email || '';
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const breakerName = wsRoute.path.includes('chat') ? 'chat' : 'notification';
      if (breakers[breakerName]?.isRejected()) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }

      // Forward upgrade to downstream
      const targetUrl = new URL(wsRoute.target);
      const proxy = http.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: url,
        method: req.method,
        headers: req.headers,
      });

      proxy.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        socket.write(
          `HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n'
        );
        if (proxyHead?.length) socket.write(proxyHead);
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);

        proxySocket.on('error', () => socket.destroy());
        socket.on('error', () => proxySocket.destroy());
      });

      proxy.on('error', (err) => {
        logger.error(`[ws] Proxy error for ${wsRoute.path}: ${err.message}`);
        breakers[breakerName]?.onFailure();
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      });

      proxy.end();
      return;
    }
  }

  // Unknown WebSocket path
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// ────────────────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────────────────
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[gateway] Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('[gateway] HTTP server closed');

    // Close Redis
    redis.quit().catch(() => {});
    logger.info('[gateway] Redis connection closed');

    logger.info('[gateway] Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 15s
  setTimeout(() => {
    logger.error('[gateway] Forced shutdown after timeout');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[gateway] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[gateway] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

// ────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
  logger.info(`   Services: ${Object.entries(SERVICES).map(([k, v]) => `${k}→${v}`).join(', ')}`);
});
