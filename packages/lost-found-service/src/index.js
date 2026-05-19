import express from 'express';
import { config, logger, connectMongo, errorHandler, metricsMiddleware, metricsHandler } from '@iuh-exchange/common';
import lostFoundRoutes from './routes/lostfound.routes.js';
import reportRoutes from './routes/report.routes.js';
import { initKafka } from './services/kafka.service.js';

const app = express();
const PORT = process.env.PORT || 3006;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_lostfound';

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
await connectMongo(MONGODB_URI);
await initKafka();

app.listen(PORT, () => {
  logger.info(`🚀 Lost & Found Service running on port ${PORT}`);
});
