import express from 'express';
import { config, logger, connectMongo, errorHandler, metricsMiddleware, metricsHandler, safeListen } from '@iuh-exchange/common';
import productRoutes from './routes/product.routes.js';
import reviewRoutes from './routes/review.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import trustRoutes from './routes/trust.routes.js';
import offerRoutes from './routes/offer.routes.js';
import { initKafkaProducer } from './services/kafka.service.js';
import { ensureIndex } from './services/elasticsearch.service.js';
import { initSagaListener, releaseExpiredReservations } from './services/saga.listener.js';

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.PRODUCT_SERVICE_MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/iuh_products';

// Middleware
app.use(express.json());
app.use(metricsMiddleware);

// Health
app.get('/health', async (req, res) => {
  const mongoose = await import('mongoose');
  const dbState = mongoose.default.connection.readyState;
  const dbOk = dbState === 1;

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'product-service',
    dependencies: {
      mongodb: dbOk ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics
app.get('/metrics', metricsHandler);

// Routes
app.use('/api/v1/products', offerRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/products', reviewRoutes);
app.use('/api/v1/products', wishlistRoutes);
app.use('/api/v1/products', trustRoutes);

// Error handler
app.use(errorHandler);

// Start HTTP as soon as critical dependencies are ready.
try {
  await connectMongo(MONGODB_URI);
} catch (err) {
  logger.error('[product-service] MongoDB connection failed:', err.message);
  process.exit(1);
}
try {
  await initKafkaProducer();
} catch (err) {
  logger.error('[product-service] Kafka producer init failed:', err.message);
  process.exit(1);
}

import { createServer } from 'http';
const server = createServer(app);
safeListen(server, PORT, () => {
  logger.info(`Product Service running on port ${PORT}`);
});

// Non-HTTP workers must not block the port from opening. Kafka group joins and
// Elasticsearch startup can take seconds, and the gateway treats that as down.
ensureIndex().catch((err) => logger.error(`Elasticsearch index init failed: ${err.message}`));
initSagaListener().catch((err) => logger.error(`Saga listener init failed: ${err.message}`));

const reservationSweepMs = Number(process.env.PRODUCT_RESERVATION_SWEEP_MS || 60_000);
const reservationSweepTimer = setInterval(() => {
  releaseExpiredReservations().catch((err) => logger.error(`Reservation sweep failed: ${err.message}`));
}, reservationSweepMs);
reservationSweepTimer.unref?.();

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[product-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[product-service] Uncaught exception:', err);
  process.exit(1);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[product-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[product-service] Uncaught exception:', err);
  process.exit(1);
});
