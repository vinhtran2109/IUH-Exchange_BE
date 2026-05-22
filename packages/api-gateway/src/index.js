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
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import {
  config,
  logger,
  errorHandler,
  getRedis,
  metricsMiddleware,
  metricsHandler,
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
  // Bug #4 fix: Default to specific origins instead of '*' (incompatible with credentials: true)
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Requested-With',
    'Idempotency-Key',
    'X-Admin-Portal',
    'X-Admin-Otp',
  ],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 3600,
}));

const jsonParser = express.json({ limit: '10mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' });

app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1') || req.path.startsWith('/ws')) {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1') || req.path.startsWith('/ws')) {
    return next();
  }
  return urlencodedParser(req, res, next);
});

// ────────────────────────────────────────────────────────
// Prometheus Metrics
// ────────────────────────────────────────────────────────
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

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
  max: 1000,
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
  max: 1000,
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
  max: 500,
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
          fixRequestBody(proxyReq, req);
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
    let latencyMs = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const start = Date.now();
      const resp = await fetch(`${url}/health`, { signal: controller.signal });
      latencyMs = Date.now() - start;
      clearTimeout(timeout);
      reachable = resp.ok;
    } catch {
      reachable = false;
    }
    serviceStates[name] = { ...breakerState, reachable, latencyMs };
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

// Liveness probe — simple "am I alive" check (no dependency checks)
app.get('/health/live', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe — checks Redis connectivity
app.get('/health/ready', async (_req, res) => {
  let redisOk = false;
  try {
    const pong = await redis.ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }

  const ready = redisOk;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'not_ready',
    service: 'api-gateway',
    dependencies: {
      redis: redisOk ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

// ────────────────────────────────────────────────────────
// Mount Routes — use express.Router() per route for reliable
// middleware chaining with http-proxy-middleware v3 async middleware.
// ────────────────────────────────────────────────────────
for (const route of routes) {
  const { path, service, public: isPublic, rateLimiter: limiterKey, methods } = route;
  const router = express.Router();

  // Restore full path — Express strips mount path from req.url,
  // but downstream services expect the full /api/v1/... path.
  router.use((req, _res, next) => {
    req.url = req.originalUrl;
    next();
  });

  // Rate limiter
  if (limiterKey && limiters[limiterKey]) {
    router.use(limiters[limiterKey]);
  }

  // Auth filter
  if (isPublic) {
    router.use(optionalAuthFilter);
  } else {
    router.use(authFilter);
  }

  // Method restriction for public routes with limited methods
  if (methods && methods.length > 0) {
    const allowed = new Set(methods.map(m => m.toUpperCase()));
    router.use((req, res, next) => {
      if (!allowed.has(req.method.toUpperCase())) {
        // Not an allowed method for this public route — check if it needs auth
        // This is a public route with restricted methods, so non-GET needs auth
        return authFilter(req, res, next);
      }
      next();
    });
  }

  // Proxy
  for (const mw of createServiceProxy(service)) {
    router.use(mw);
  }

  app.use(path, router);
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
// WebSocket Proxy — SockJS + STOMP for chat & notifications
// SockJS uses HTTP-based fallback transports alongside WebSocket upgrade.
// All /ws traffic routes to the chat-service which handles both
// chat and notification STOMP destinations.
// ────────────────────────────────────────────────────────

const CHAT_SERVICE_URL = SERVICES.chat;

// SockJS HTTP-based transports: xhr-streaming, xhr-polling, eventsource,
// htmlfile, jsonp-polling — these are normal HTTP requests that must be proxied.
// SockJS also serves /ws/info (capabilities check) and /ws/{server}/{session}/{transport}.
const sockjsProxy = createProxyMiddleware({
  target: CHAT_SERVICE_URL,
  changeOrigin: true,
  ws: false, // HTTP transports handled here; WebSocket upgrade handled separately
  timeout: 30_000,
  proxyTimeout: 30_000,
  pathRewrite: (path) => path, // Keep /ws prefix intact — downstream expects it
  on: {
    proxyReq(proxyReq) {
      proxyReq.setHeader('X-Forwarded-Proto', 'http');
    },
    error(err, req, res) {
      logger.error(`[ws-http] SockJS proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          statusCode: 502,
          message: 'Chat service unavailable.',
          timestamp: new Date().toISOString(),
        }));
      }
    },
  },
});

// Mount SockJS HTTP transport proxy at /ws
app.use('/ws', (req, res, next) => {
  // Restore full path — Express strips mount prefix (/ws) from req.url,
  // but downstream service expects the full /ws/... path.
  req.url = req.originalUrl;

  // WebSocket upgrade requests are handled by server.on('upgrade') below.
  // This middleware handles only HTTP-based SockJS transports.
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return next();
  }
  sockjsProxy(req, res, next);
});

// WebSocket upgrade handler for SockJS websocket transport
server.on('upgrade', (req, socket, head) => {
  const { url } = req;

  // SockJS websocket transport: /ws/<server_id>/<session_id>/websocket
  if (url.startsWith('/ws/')) {
    // Extract JWT from query string (SockJS doesn't support custom headers
    // on WebSocket upgrade, so the client passes token as query param)
    // Also check Authorization header for non-SockJS clients.
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

    const targetUrl = new URL(CHAT_SERVICE_URL);
    const proxyReq = http.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: url,
      method: req.method,
      headers: req.headers,
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
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

    proxyReq.on('error', (err) => {
      logger.error(`[ws] Proxy error for ${url}: ${err.message}`);
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
    });

    proxyReq.end();
    return;
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
