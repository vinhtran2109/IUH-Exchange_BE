import express from 'express';
import { createServer } from 'http';
import { config, logger, createRedis } from '@iuh-exchange/common';
import { initSocketService } from './services/socket.service.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 3007;

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ws-gateway', timestamp: new Date().toISOString() });
});

// ── Initialize WebSocket service ──
const { publishNotification, sendNotificationToUser, getOnlineUsers } = initSocketService(httpServer);

// ── REST endpoint for other services to push notifications ──
app.use(express.json());

app.post('/internal/notify', (req, res) => {
  const { userId, notification } = req.body;
  if (!userId || !notification) {
    return res.status(400).json({ error: 'userId and notification required' });
  }
  sendNotificationToUser(String(userId), notification);
  res.json({ success: true });
});

app.post('/internal/broadcast', (req, res) => {
  const { notification } = req.body;
  if (!notification) {
    return res.status(400).json({ error: 'notification required' });
  }
  publishNotification(notification);
  res.json({ success: true });
});

app.get('/internal/online-users', (_req, res) => {
  res.json({ users: getOnlineUsers() });
});

// ── Start ──
httpServer.listen(PORT, () => {
  logger.info(`🚀 WS Gateway running on port ${PORT}`);
});
