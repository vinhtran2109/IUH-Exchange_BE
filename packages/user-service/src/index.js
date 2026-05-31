import express from 'express';
import {
  config,
  logger,
  connectMongo,
  pingSupabase,
  errorHandler,
  auditLog,
  metricsMiddleware,
  metricsHandler,
  safeListen,
} from '@iuh-exchange/common';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { initKafkaProducer } from './services/kafka.service.js';
import { startKarmaConsumer } from './services/karma-consumer.service.js';

const app = express();
const PORT = process.env.PORT || 3001;
const AUDIT_MONGODB_URI = process.env.MONGODB_URI || process.env.USER_SERVICE_MONGO_URI;

// ── Middleware ──
app.use(express.json());
app.use(metricsMiddleware);
app.use(auditLog());

// ── Health ──
app.get('/health', async (req, res) => {
  let dbOk = true;
  try {
    await pingSupabase();
  } catch {
    dbOk = false;
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'user-service',
    dependencies: {
      supabase: dbOk ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Prometheus Metrics ──
app.get('/metrics', metricsHandler);

// ── Routes ──
app.use('/api/v1/auth', authRoutes);
// Admin routes MUST be before /users to avoid /:id catching "admin"
app.use('/api/v1/users/admin', adminRoutes);
// Also mount at /api/v1/admin for spec-compliant paths
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
try {
  if (AUDIT_MONGODB_URI) {
    await connectMongo(AUDIT_MONGODB_URI);
  }
  await pingSupabase();
  await initKafkaProducer();
  await startKarmaConsumer();
} catch (err) {
  logger.error('[user-service] Startup failed:', err.message);
  process.exit(1);
}

import { createServer } from 'http';
const server = createServer(app);
safeListen(server, PORT, () => {
  logger.info(`🚀 User Service running on port ${PORT}`);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[user-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[user-service] Uncaught exception:', err);
  process.exit(1);
});
