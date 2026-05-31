import express from 'express';
import { createServer } from 'http';
import { config, logger, createRedis, safeListen } from '@iuh-exchange/common';
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

// Bug #2 fix: Internal endpoints require x-internal-key header
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'];
  const expected = process.env.INTERNAL_API_KEY || 'iuh-internal-secret';
  if (!key || key !== expected) {
    return res.status(403).json({ error: 'Forbidden: invalid or missing x-internal-key' });
  }
  next();
}

app.post('/internal/notify', requireInternalKey, (req, res) => {
  const { userId, notification } = req.body;
  if (!userId || !notification) {
    return res.status(400).json({ error: 'userId and notification required' });
  }
  sendNotificationToUser(String(userId), notification);
  res.json({ success: true });
});

app.post('/internal/broadcast', requireInternalKey, (req, res) => {
  const { notification } = req.body;
  if (!notification) {
    return res.status(400).json({ error: 'notification required' });
  }
  publishNotification(notification);
  res.json({ success: true });
});

app.get('/internal/online-users', requireInternalKey, (_req, res) => {
  res.json({ users: getOnlineUsers() });
});

// ── Start ──
safeListen(httpServer, PORT, () => {
  logger.info(`🚀 WS Gateway running on port ${PORT}`);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[ws-gateway] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[ws-gateway] Uncaught exception:', err);
  process.exit(1);
});

// ── Process Error Handlers ──
process.on('unhandledRejection', (reason) => {
  logger.error('[ws-gateway] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[ws-gateway] Uncaught exception:', err);
  process.exit(1);
});
