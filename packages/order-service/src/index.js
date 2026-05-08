import express from 'express';
import { config, logger, connectMongo, errorHandler, getRedis } from '@iuh-exchange/common';
import { OrderService } from './services/order.service.js';
import { initProducer, startSagaConsumer } from './services/saga.service.js';
import { createOrderRoutes } from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';

const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_orders';

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

// Mount order routes
app.use('/api/v1/orders', createOrderRoutes(orderService));

// Mount payment routes
app.use('/api/v1/orders', paymentRoutes);

// Global error handler (must be after routes)
app.use(errorHandler);

// ── Connect DB and start server ──────────────────────────────────────
await connectMongo(MONGODB_URI);

app.listen(PORT, () => {
  logger.info(`🚀 Order Service running on port ${PORT}`);
});
