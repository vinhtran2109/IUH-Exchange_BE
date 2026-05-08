import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyToken, logger } from '@iuh-exchange/common';
import { ChatMessage } from '../models/ChatMessage.js';

const CHAT_CHANNEL = 'chat:messages';

/**
 * Build a conversationId from two user IDs (sorted, joined by ":").
 */
export function buildConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join(':');
}

/**
 * Initialize Socket.IO with JWT auth, Redis adapter for horizontal scaling,
 * and all chat event handlers.
 *
 * @param {import('http').Server} httpServer
 * @returns {{ io: Server, pubClient: import('redis').RedisClientType, subClient: import('redis').RedisClientType }}
 */
export function initSocketService(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Redis adapter for multi-instance scaling ──
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  const pubClient = createClient({ url: `redis://${redisHost}:${redisPort}`, password: redisPassword });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter connected — multi-instance scaling enabled');
    })
    .catch((err) => {
      logger.warn('Redis adapter unavailable, running single-instance mode', { error: err.message });
    });

  // ── JWT Authentication middleware ──
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      const decoded = verifyToken(token);
      socket.userId = decoded.sub;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      logger.warn('Socket auth failed', { error: err.message });
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──
  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);
    logger.info(`Chat WS connected: ${userId}`);

    // ── Join a conversation room ──
    socket.on('join:conversation', (conversationId) => {
      if (typeof conversationId === 'string' && conversationId.length > 0) {
        socket.join(`conv:${conversationId}`);
        logger.debug(`User ${userId} joined conversation ${conversationId}`);
      }
    });

    // ── Leave a conversation room ──
    socket.on('leave:conversation', (conversationId) => {
      if (typeof conversationId === 'string' && conversationId.length > 0) {
        socket.leave(`conv:${conversationId}`);
        logger.debug(`User ${userId} left conversation ${conversationId}`);
      }
    });

    // ── Send message ──
    socket.on('message:send', async (data, callback) => {
      try {
        const { receiverId, content, conversationId: providedConvId } = data;

        if (!receiverId || !content || typeof content !== 'string' || content.trim().length === 0) {
          const error = { success: false, message: 'receiverId and non-empty content are required' };
          if (typeof callback === 'function') return callback(error);
          return socket.emit('error', error);
        }

        const conversationId = providedConvId || buildConversationId(userId, receiverId);

        const message = await ChatMessage.create({
          senderId: userId,
          receiverId,
          content: content.trim(),
          conversationId,
        });

        const messageObj = message.toObject();

        // Emit to conversation room (everyone in the room sees it)
        io.to(`conv:${conversationId}`).emit('message:new', messageObj);

        // Also emit to receiver's personal room for notification (even if not in conversation room)
        io.to(`user:${receiverId}`).emit('message:notification', {
          conversationId,
          message: messageObj,
        });

        // Acknowledge to sender
        if (typeof callback === 'function') {
          callback({ success: true, data: messageObj });
        }
      } catch (err) {
        logger.error('message:send error', { error: err.message, userId });
        const error = { success: false, message: 'Failed to send message' };
        if (typeof callback === 'function') return callback(error);
        socket.emit('error', error);
      }
    });

    // ── Mark messages as read ──
    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        await ChatMessage.updateMany(
          { conversationId, receiverId: userId, isRead: false },
          { isRead: true },
        );

        // Notify the other participant that messages were read
        io.to(`conv:${conversationId}`).emit('message:read:ack', {
          conversationId,
          userId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('message:read error', { error: err.message, userId });
      }
    });

    // ── Typing indicator ──
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('typing:start', { conversationId, userId });
      }
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      logger.info(`Chat WS disconnected: ${userId}`, { reason });
    });
  });

  return { io, pubClient, subClient };
}
