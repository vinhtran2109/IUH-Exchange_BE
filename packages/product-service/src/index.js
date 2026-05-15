import express from 'express';
import { config, logger, connectMongo, errorHandler } from '@iuh-exchange/common';
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

// ── Middleware ──
app.use(express.json());

// ── Health ──
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

// ── Routes ──
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/products', reviewRoutes);
app.use('/api/v1/products', wishlistRoutes);
app.use('/api/v1/products', trustRoutes);
app.use('/api/v1/products', offerRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
await connectMongo(MONGODB_URI);
await initKafkaProducer();
await ensureIndex();
await initSagaListener();

const reservationSweepMs = Number(process.env.PRODUCT_RESERVATION_SWEEP_MS || 60_000);
const reservationSweepTimer = setInterval(() => {
  releaseExpiredReservations().catch((err) => logger.error(`Reservation sweep failed: ${err.message}`));
}, reservationSweepMs);
reservationSweepTimer.unref?.();

app.listen(PORT, () => {
  logger.info(`🚀 Product Service running on port ${PORT}`);
});
