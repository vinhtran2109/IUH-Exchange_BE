import express from 'express';
import { createServer } from 'http';
import { config, logger, connectMongo, errorHandler } from '@iuh-exchange/common';
import { initSocketService } from './services/socket.service.js';
import chatRoutes from './routes/chat.routes.js';
import chatUploadRoutes from './routes/chat-upload.routes.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3005;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_chat';

// ── Body parsing ──
app.use(express.json());

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() });
});

// ── REST API routes ──
app.use('/api/v1/chat', chatUploadRoutes);
app.use('/api/v1/chat', chatRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Initialize SockJS + STOMP server on /ws ──
initSocketService(httpServer);

// ── Start ──
await connectMongo(MONGODB_URI);
httpServer.listen(PORT, () => {
  logger.info(`🚀 Chat Service running on port ${PORT}`);
});
