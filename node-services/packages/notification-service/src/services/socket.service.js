import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyToken, logger } from '@iuh-exchange/common';

/**
 * Initialize Socket.IO for the notification service.
 * Users connect to receive real-time notifications.
 *
 * @param {import('http').Server} httpServer
 * @returns {{ io: Server, pubClient: import('redis').RedisClientType, subClient: import('redis').RedisClientType }}
 */
export function initNotificationSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    path: '/ws-notify',
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
      logger.info('Notification Socket.IO Redis adapter connected');
    })
    .catch((err) => {
      logger.warn('Redis adapter unavailable for notifications, single-instance mode', { error: err.message });
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
      next();
    } catch (err) {
      logger.warn('Notification socket auth failed', { error: err.message });
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──
  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);
    logger.info(`Notification WS connected: ${userId}`);

    // ── Mark notification as read (client can do this via WS too) ──
    socket.on('notification:read', async (data) => {
      try {
        const { Notification } = await import('../models/Notification.js');
        const { notificationId } = data;
        if (!notificationId) return;

        const notification = await Notification.findOneAndUpdate(
          { _id: notificationId, recipientId: userId },
          { isRead: true },
          { new: true },
        );

        if (notification) {
          socket.emit('notification:read:ack', { notificationId, isRead: true });
        }
      } catch (err) {
        logger.error('notification:read error', { error: err.message, userId });
      }
    });

    // ── Mark all as read ──
    socket.on('notification:read-all', async () => {
      try {
        const { Notification } = await import('../models/Notification.js');
        await Notification.updateMany({ recipientId: userId, isRead: false }, { isRead: true });
        socket.emit('notification:read-all:ack', { success: true });
      } catch (err) {
        logger.error('notification:read-all error', { error: err.message, userId });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Notification WS disconnected: ${userId}`, { reason });
    });
  });

  return { io, pubClient, subClient };
}
