import express from 'express';
import { config, logger, pingSupabase, errorHandler, getRedis, metricsMiddleware, metricsHandler, safeListen } from '@iuh-exchange/common';
import { OrderService } from './services/order.service.js';
import { initProducer, startSagaConsumer } from './services/saga.service.js';
import { createOrderRoutes } from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';

const PORT = process.env.PORT || 3003;

// Initialize dependencies
const redis = getRedis();

// Initialize Kafka producer
try {
  await initProducer();
} catch (err) {
  logger.error('[order-service] Kafka producer init failed:', err.message);
  process.exit(1);
}

// Create service instances
const orderService = new OrderService();

// Express app
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

// Prometheus metrics
app.get('/metrics', metricsHandler);

// Mount order routes
app.use('/api/v1/orders', createOrderRoutes(orderService));

// Mount payment routes
app.use('/api/v1/orders', paymentRoutes);

// Global error handler (must be after routes)
app.use(errorHandler);

// Connect DB and start server
try {
  await pingSupabase();
} catch (err) {
  logger.error('[order-service] Supabase connection failed:', err.message);
  process.exit(1);
}

import { createServer } from 'http';
const server = createServer(app);
safeListen(server, PORT, () => {
  logger.info(`Order Service running on port ${PORT}`);
});

// Kafka group joins can take seconds; keep HTTP available while the consumer starts.
startSagaConsumer(orderService).catch((err) => {
  logger.error(`Saga consumer failed to start: ${err.message}`);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[order-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[order-service] Uncaught exception:', err);
  process.exit(1);
});
