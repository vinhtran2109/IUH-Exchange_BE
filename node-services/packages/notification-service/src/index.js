import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config, logger, connectMongo, errorHandler, verifyToken } from '@iuh-exchange/common';
import { Notification } from './models/Notification.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
});

const PORT = process.env.PORT || 3004;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_notifications';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

// ── REST: Get notifications ──
app.get('/api/v1/notifications', async (req, res) => {
  const userId = req.user?.sub;
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(100, parseInt(req.query.size || '20'));

  const [notifications, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size),
    Notification.countDocuments({ userId }),
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: { content: notifications, page, size, totalElements: total, totalPages: Math.ceil(total / size), last: page * size >= total },
    timestamp: new Date().toISOString(),
  });
});

// ── WebSocket: Real-time notifications ──
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = verifyToken(token);
    socket.userId = decoded.sub;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  socket.join(`user:${userId}`);
  logger.info(`Notification WS connected: ${userId}`);

  socket.on('disconnect', () => {
    logger.info(`Notification WS disconnected: ${userId}`);
  });
});

// Export io for other services to emit events
export { io };

// ── Kafka consumer for notification events (TODO: Phase 5) ──
// Will listen to order.created, product.reserved, etc.

app.use(errorHandler);

await connectMongo(MONGODB_URI);
httpServer.listen(PORT, () => logger.info(`🚀 Notification Service running on port ${PORT}`));
