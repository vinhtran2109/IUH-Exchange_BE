import express from 'express';
import { config, logger, connectMongo, errorHandler, metricsMiddleware, metricsHandler, safeListen } from '@iuh-exchange/common';
import lostFoundRoutes from './routes/lostfound.routes.js';
import reportRoutes from './routes/report.routes.js';
import { initKafka } from './services/kafka.service.js';
import { cleanupStuckProcessing } from './services/image-processor.service.js';

const app = express();
const PORT = process.env.PORT || 3006;
const MONGODB_URI = process.env.LOSTFOUND_SERVICE_MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_lostfound';

app.use(express.json());
app.use(metricsMiddleware);

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lost-found-service', timestamp: new Date().toISOString() });
});

// ── Prometheus Metrics ──
app.get('/metrics', metricsHandler);

// ── Routes ──
app.use('/api/v1/lost-found', lostFoundRoutes);
app.use('/api/v1/reports', reportRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Bootstrap ──
try {
  await connectMongo(MONGODB_URI);
} catch (err) {
  logger.error('[lost-found-service] MongoDB connection failed:', err.message);
  process.exit(1);
}
try {
  await initKafka();
} catch (err) {
  logger.error('[lost-found-service] Kafka init failed:', err.message);
  process.exit(1);
}

// BUG FIX #11: Cleanup các item bị stuck PROCESSING khi service khởi động.
// Nếu service crash giữa chừng, item sẽ bị stuck vĩnh viễn → reset về PENDING.
try {
  await cleanupStuckProcessing(10);
} catch (err) {
  logger.error('[lost-found-service] Cleanup stuck processing failed:', err.message);
}
// Cron job: chạy lại mỗi 10 phút để bắt các case mới
const stuckProcessingTimer = setInterval(() => cleanupStuckProcessing(10), 10 * 60 * 1000);
stuckProcessingTimer.unref();

import { createServer } from 'http';
const server = createServer(app);
safeListen(server, PORT, () => {
  logger.info(`🚀 Lost & Found Service running on port ${PORT}`);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[lost-found-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[lost-found-service] Uncaught exception:', err);
  process.exit(1);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[lost-found-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[lost-found-service] Uncaught exception:', err);
  process.exit(1);
});
