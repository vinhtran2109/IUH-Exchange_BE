import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config, logger, connectMongo, errorHandler, verifyToken } from '@iuh-exchange/common';
import { ChatMessage } from './models/ChatMessage.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
});

const PORT = process.env.PORT || 3005;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_chat';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() });
});

// ── REST: Get conversation history ──
app.get('/api/v1/chat/:conversationId', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(100, parseInt(req.query.size || '50'));

  const [messages, total] = await Promise.all([
    ChatMessage.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(size),
    ChatMessage.countDocuments({ conversationId: req.params.conversationId }),
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: { content: messages.reverse(), page, size, totalElements: total, totalPages: Math.ceil(total / size), last: page * size >= total },
    timestamp: new Date().toISOString(),
  });
});

// ── REST: Get user's conversations ──
app.get('/api/v1/chat/conversations/list', async (req, res) => {
  const userId = req.user?.sub;

  // Get unique conversations for this user
  const conversations = await ChatMessage.aggregate([
    { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$conversationId',
      lastMessage: { $first: '$$ROOT' },
      unreadCount: {
        $sum: { $cond: [{ $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$isRead', false] }] }, 1, 0] },
      },
    }},
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: conversations,
    timestamp: new Date().toISOString(),
  });
});

// ── WebSocket: Real-time chat ──
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
  logger.info(`Chat WS connected: ${userId}`);

  // Join a conversation room
  socket.on('join:conversation', (conversationId) => {
    socket.join(`conv:${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave:conversation', (conversationId) => {
    socket.leave(`conv:${conversationId}`);
  });

  // Send message
  socket.on('message:send', async (data) => {
    try {
      const { receiverId, content, conversationId } = data;
      const convId = conversationId || [userId, receiverId].sort().join(':');

      const message = await ChatMessage.create({
        senderId: userId,
        receiverId,
        content,
        conversationId: convId,
      });

      // Emit to conversation room
      io.to(`conv:${convId}`).emit('message:new', message);

      // Also emit to receiver's personal room (for notification)
      io.to(`user:${receiverId}`).emit('message:notification', {
        conversationId: convId,
        message,
      });
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
      logger.error('Chat message error:', err);
    }
  });

  // Mark messages as read
  socket.on('message:read', async (data) => {
    const { conversationId } = data;
    await ChatMessage.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { isRead: true }
    );
    io.to(`conv:${conversationId}`).emit('message:read:ack', { conversationId, userId });
  });

  socket.on('disconnect', () => {
    logger.info(`Chat WS disconnected: ${userId}`);
  });
});

app.use(errorHandler);

await connectMongo(MONGODB_URI);
httpServer.listen(PORT, () => logger.info(`🚀 Chat Service running on port ${PORT}`));
