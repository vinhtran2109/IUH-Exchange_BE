import express from 'express';
import { config, logger, pingSupabase, errorHandler, getRedis, metricsMiddleware, metricsHandler } from '@iuh-exchange/common';
import { OrderService } from './services/order.service.js';
import { initProducer, startSagaConsumer } from './services/saga.service.js';
import { createOrderRoutes } from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';

const PORT = process.env.PORT || 3003;

// ── Initialize dependencies ──────────────────────────────────────────
const redis = getRedis();

// Initialize Kafka producer
await initProducer();

// ── Create service instances ─────────────────────────────────────────
const orderService = new OrderService();

// ── Start Kafka consumer for saga events ─────────────────────────────
await startSagaConsumer(orderService);

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(metricsMiddleware);

// Health check
app.get('/health', async (req, res) => {
  let dbOk = true;
  try {
    await pingSupabase();
  } catch {
    dbOk = false;
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'order-service',
    dependencies: {
      supabase: dbOk ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

// Prometheus Metrics
app.get('/metrics', metricsHandler);

// Mount order routes
app.use('/api/v1/orders', createOrderRoutes(orderService));

// Mount payment routes
app.use('/api/v1/orders', paymentRoutes);

// Global error handler (must be after routes)
app.use(errorHandler);

// ── Connect DB and start server ──────────────────────────────────────
await pingSupabase();

app.listen(PORT, () => {
  logger.info(`🚀 Order Service running on port ${PORT}`);
});
