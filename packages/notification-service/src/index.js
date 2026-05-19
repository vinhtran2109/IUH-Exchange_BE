import express from 'express';
import { createServer } from 'http';
import { config, logger, connectMongo, errorHandler, metricsMiddleware, metricsHandler } from '@iuh-exchange/common';
import { initNotificationSocket } from './services/socket.service.js';
import { startKafkaConsumer } from './services/kafka-consumer.service.js';
import notificationRoutes from './routes/notification.routes.js';
import dlqRoutes from './routes/dlq.routes.js';
import fcmRoutes from './routes/fcm.routes.js';
import preferenceRoutes from './routes/preference.routes.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3004;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_notifications';

// ── Body parsing ──
app.use(express.json());
app.use(metricsMiddleware);

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

// ── Prometheus Metrics ──
app.get('/metrics', metricsHandler);

// ── REST API routes ──
app.use('/api/v1/notifications/dlq', dlqRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/notifications', fcmRoutes);
app.use('/api/v1/notifications/preferences', preferenceRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Initialize Redis pub/sub for notification delivery ──
initNotificationSocket();

// ── Connect MongoDB ──
await connectMongo(MONGODB_URI);

// ── Start Kafka consumer ──
try {
  await startKafkaConsumer();
} catch (err) {
  logger.error('Kafka consumer failed to start — notification events will not be processed', { error: err.message });
}

// ── Start server ──
httpServer.listen(PORT, () => {
  logger.info(`🚀 Notification Service running on port ${PORT}`);
});
