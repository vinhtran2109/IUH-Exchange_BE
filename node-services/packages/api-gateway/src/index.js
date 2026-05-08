import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import {
  config,
  logger,
  errorHandler,
  authenticate,
  getRedis,
} from '@iuh-exchange/common';

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;

// ── Security ──
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// ── Request logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ── Rate Limiting (Redis-backed) ──
const redis = getRedis();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:global:',
  }),
});
app.use(globalLimiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:auth:',
  }),
});

// ── Service routing map ──
const SERVICES = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3005',
  lostfound: process.env.LOSTFOUND_SERVICE_URL || 'http://localhost:3006',
};

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ── Auth routes (rate limited) ──
app.use('/api/v1/auth', authLimiter, createProxyMiddleware({
  target: SERVICES.user,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '/api/v1/auth' },
}));

// ── Protected routes ──
// User service
app.use('/api/v1/users', authenticate, createProxyMiddleware({
  target: SERVICES.user,
  changeOrigin: true,
}));

// Product service
app.use('/api/v1/products', createProxyMiddleware({
  target: SERVICES.product,
  changeOrigin: true,
}));

// Order service
app.use('/api/v1/orders', authenticate, createProxyMiddleware({
  target: SERVICES.order,
  changeOrigin: true,
}));

// Notification service
app.use('/api/v1/notifications', authenticate, createProxyMiddleware({
  target: SERVICES.notification,
  changeOrigin: true,
}));

// Lost & Found service
app.use('/api/v1/lost-found', createProxyMiddleware({
  target: SERVICES.lostfound,
  changeOrigin: true,
}));

// Reports
app.use('/api/v1/reports', authenticate, createProxyMiddleware({
  target: SERVICES.lostfound,
  changeOrigin: true,
}));

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`   Proxying to services:`, SERVICES);
});
