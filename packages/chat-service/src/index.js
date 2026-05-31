import express from 'express';
import { createServer } from 'http';
import { config, logger, connectMongo, errorHandler, metricsMiddleware, metricsHandler, safeListen } from '@iuh-exchange/common';
import { initSocketService } from './services/socket.service.js';
import chatRoutes from './routes/chat.routes.js';
import chatUploadRoutes from './routes/chat-upload.routes.js';
import aiAssistantRoutes from './routes/ai-assistant.routes.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3005;
const MONGODB_URI = process.env.CHAT_SERVICE_MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_chat';

// ── Body parsing ──
app.use(express.json());
app.use(metricsMiddleware);

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() });
});

// ── Prometheus Metrics ──
app.get('/metrics', metricsHandler);

// ── REST API routes ──
app.use('/api/v1/chat', chatUploadRoutes);
app.use('/api/v1/chat', aiAssistantRoutes);
app.use('/api/v1/chat', chatRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Initialize SockJS + STOMP server on /ws ──
initSocketService(httpServer);

// ── Start ──
try {
  await connectMongo(MONGODB_URI);
} catch (err) {
  logger.error('[chat-service] MongoDB connection failed:', err.message);
  process.exit(1);
}

safeListen(httpServer, PORT, () => {
  logger.info(`🚀 Chat Service running on port ${PORT}`);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[chat-service] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[chat-service] Uncaught exception:', err);
  process.exit(1);
});
