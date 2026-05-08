import sockjs from 'sockjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { config, logger, createRedis } from '@iuh-exchange/common';
import { FrameAccumulator, serializeFrame } from '../utils/stomp-parser.js';

const REDIS_NOTIF_CHANNEL = 'sockjs:notifications';
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:3005';

/**
 * Build internal service headers for proxying requests to downstream services.
 * Uses the same HMAC signature format as the API gateway auth filter,
 * so downstream services with verifyGatewaySignature middleware will accept these.
 */
function buildInternalHeaders(userId, role = 'USER', email = '') {
  const secret = config.gatewaySecret || config.jwt.secret;
  const payload = `${userId}:${role}:${email}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return {
    'x-internal-service': 'ws-gateway',
    'x-user-id': String(userId),
    'x-user-role': role,
    'x-user-email': email,
    'x-gateway-signature': signature,
  };
}

/**
 * Build a conversationId from two user IDs (sorted, joined by ":").
 */
export function buildConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join(':');
}

// ── Session & subscription tracking ──
const sessions = new Map();
const userSessions = new Map();

let redisPublisher = null;
let redisSubscriber = null;

function sendFrame(conn, command, headers, body = '') {
  if (conn.readyState === 1) {
    conn.write(serializeFrame(command, headers, body));
  }
}

export function publishNotification(notification) {
  if (!redisPublisher) return;
  try {
    redisPublisher.publish(REDIS_NOTIF_CHANNEL, JSON.stringify(notification));
  } catch (err) {
    logger.error('Failed to publish notification to Redis', { error: err.message });
  }
}

export function sendNotificationToUser(userId, notification) {
  const connIds = userSessions.get(userId);
  if (!connIds || connIds.size === 0) return;

  for (const connId of connIds) {
    const sessionData = sessions.get(connId);
    if (!sessionData) continue;

    for (const sub of sessionData.subscriptions.values()) {
      if (sub.destination.startsWith('/user/queue/')) {
        const conn = sessionData.conn;
        if (conn) {
          sendFrame(conn, 'MESSAGE', {
            'destination': sub.destination,
            'content-type': 'application/json',
            'message-id': `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          }, JSON.stringify(notification));
        }
      }
    }
  }
}

export function getOnlineUsers() {
  return Array.from(userSessions.keys());
}

function broadcastToTopic(destination, command, headers, body, excludeConnId) {
  for (const [connId, data] of sessions.entries()) {
    if (connId === excludeConnId) continue;
    if (!data.authenticated) continue;

    for (const sub of data.subscriptions.values()) {
      if (sub.destination === destination) {
        const conn = data.conn;
        if (conn) {
          sendFrame(conn, command, { ...headers, 'subscription': sub.id }, body);
        }
      }
    }
  }
}

/**
 * Create and attach the SockJS + STOMP server to the given HTTP server.
 * This WS Gateway proxies messages to the chat-service via REST API.
 */
export function initSocketService(httpServer) {
  const sockServer = sockjs.createServer({
    prefix: '/ws',
    sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',
    heartbeat_delay: 25000,
    disconnect_delay: 5000,
  });

  // Redis for cross-instance delivery
  redisPublisher = createRedis();
  redisSubscriber = createRedis();

  redisSubscriber.subscribe(REDIS_NOTIF_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to Redis notification channel', { error: err.message });
    } else {
      logger.info('Subscribed to Redis notification channel');
    }
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel !== REDIS_NOTIF_CHANNEL) return;
    try {
      const notification = JSON.parse(message);
      sendNotificationToUser(String(notification.recipientId), notification);
    } catch (err) {
      logger.error('Error processing Redis notification', { error: err.message });
    }
  });

  // ── Connection handler ──
  sockServer.on('connection', (conn) => {
    const accumulator = new FrameAccumulator();
    const sessionData = {
      conn,
      subscriptions: new Map(),
      authenticated: false,
      userId: null,
      userEmail: null,
    };

    sessions.set(conn.id, sessionData);

    conn.on('data', (message) => {
      accumulator.push(message);

      while (accumulator.hasFrames()) {
        const frame = accumulator.nextFrame();
        if (!frame) break;

        switch (frame.command) {
          case 'CONNECT':
          case 'STOMP':
            handleConnect(conn, frame, sessionData);
            break;
          case 'SUBSCRIBE':
            handleSubscribe(conn, frame, sessionData);
            break;
          case 'UNSUBSCRIBE':
            handleUnsubscribe(conn, frame, sessionData);
            break;
          case 'SEND':
            handleSend(conn, frame, sessionData);
            break;
          case 'DISCONNECT':
            sendFrame(conn, 'RECEIPT', { 'receipt-id': frame.headers['receipt'] || '' });
            conn.close();
            break;
          default:
            sendFrame(conn, 'ERROR', { 'message': `Unknown command: ${frame.command}` });
            break;
        }
      }
    });

    conn.on('close', () => {
      const data = sessions.get(conn.id);
      if (data && data.userId) {
        const conns = userSessions.get(data.userId);
        if (conns) {
          conns.delete(conn.id);
          if (conns.size === 0) userSessions.delete(data.userId);
        }
        logger.info(`WS disconnected: ${data.userId}`);
      }
      sessions.delete(conn.id);
    });
  });

  sockServer.installHandlers(httpServer, { prefix: '/ws' });
  logger.info('SockJS + STOMP WS Gateway initialized on /ws');

  return { sockServer, publishNotification, sendNotificationToUser, getOnlineUsers };
}

// ── STOMP handlers ──

function handleConnect(conn, frame, sessionData) {
  const authHeader = frame.headers['Authorization'] || frame.headers['authorization'] || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (!token) {
    sendFrame(conn, 'ERROR', { 'message': 'Authentication required' }, 'Missing Authorization header');
    conn.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = String(decoded.sub || decoded.userId || decoded.id || '');

    if (!userId) {
      sendFrame(conn, 'ERROR', { 'message': 'Invalid token' }, 'No user identity in token');
      conn.close();
      return;
    }

    sessionData.userId = userId;
    sessionData.userEmail = decoded.email || '';
    sessionData.authenticated = true;

    if (!userSessions.has(userId)) userSessions.set(userId, new Set());
    userSessions.get(userId).add(conn.id);

    sendFrame(conn, 'CONNECTED', {
      'version': '1.1',
      'heart-beat': '25000,25000',
      'user-id': userId,
    });

    logger.info(`WS connected: ${userId}`);
  } catch (err) {
    logger.warn('CONNECT auth failed', { error: err.message });
    sendFrame(conn, 'ERROR', { 'message': 'Authentication failed' }, 'Invalid or expired token');
    conn.close();
  }
}

function handleSubscribe(conn, frame, sessionData) {
  if (!sessionData.authenticated) {
    sendFrame(conn, 'ERROR', { 'message': 'Not authenticated' });
    return;
  }

  const destination = frame.headers['destination'];
  const subId = frame.headers['id'] || `sub-${Date.now()}`;

  if (!destination) {
    sendFrame(conn, 'ERROR', { 'message': 'Missing destination' });
    return;
  }

  sessionData.subscriptions.set(subId, { id: subId, destination });
  logger.debug(`User ${sessionData.userId} subscribed to ${destination}`);
}

function handleUnsubscribe(conn, frame, sessionData) {
  const subId = frame.headers['id'];
  if (subId) sessionData.subscriptions.delete(subId);
}

async function handleSend(conn, frame, sessionData) {
  if (!sessionData.authenticated) {
    sendFrame(conn, 'ERROR', { 'message': 'Not authenticated' });
    return;
  }

  const destination = frame.headers['destination'];
  const userId = sessionData.userId;

  if (destination === '/app/chat') {
    await handleChatSend(conn, frame, userId);
  } else if (destination === '/app/chat.image') {
    await handleChatImage(conn, frame, userId);
  } else if (destination === '/app/chat.read') {
    await handleChatRead(conn, frame, userId);
  } else if (destination === '/app/typing') {
    handleTyping(conn, frame, userId);
  } else {
    sendFrame(conn, 'ERROR', { 'message': `Unknown destination: ${destination}` });
  }
}

/**
 * Proxy chat message to chat-service REST API.
 */
async function handleChatSend(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { recipientId, content } = body;

    if (!recipientId || !content || content.trim().length === 0) {
      sendFrame(conn, 'ERROR', { 'message': 'Validation failed' }, 'recipientId and content required');
      return;
    }

    if (content.length > 5000) {
      sendFrame(conn, 'ERROR', { 'message': 'Validation failed' }, 'Content exceeds 5000 chars');
      return;
    }

    const conversationId = buildConversationId(userId, recipientId);

    // Proxy to chat-service (with gateway signature for downstream auth)
    const response = await axios.post(`${CHAT_SERVICE_URL}/api/v1/chat/messages`, {
      senderId: userId,
      receiverId: recipientId,
      content: content.trim(),
      conversationId,
    }, {
      headers: buildInternalHeaders(userId),
      timeout: 5000,
    });

    const messageObj = response.data?.data || response.data;
    const messageJson = JSON.stringify(messageObj);

    // Broadcast to conversation topic
    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `msg-${messageObj._id || Date.now()}`,
    }, messageJson);

    // Deliver to recipient's private queue
    deliverToUser(recipientId, '/user/queue/messages', messageJson);

    // Deliver to sender's other tabs
    deliverToUser(userId, '/user/queue/messages', messageJson, conn.id);

    const receiptId = frame.headers['receipt'];
    if (receiptId) sendFrame(conn, 'RECEIPT', { 'receipt-id': receiptId });
  } catch (err) {
    logger.error('chat send proxy error', { error: err.message, userId });
    sendFrame(conn, 'ERROR', { 'message': 'Failed to send message' });
  }
}

async function handleChatImage(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { recipientId, fileUrl, fileName } = body;

    if (!recipientId || !fileUrl) {
      sendFrame(conn, 'ERROR', { 'message': 'Validation failed' }, 'recipientId and fileUrl required');
      return;
    }

    const conversationId = buildConversationId(userId, recipientId);

    const response = await axios.post(`${CHAT_SERVICE_URL}/api/v1/chat/messages`, {
      senderId: userId,
      receiverId: recipientId,
      content: fileName || 'Image',
      conversationId,
      messageType: 'IMAGE',
      fileUrl,
      fileName: fileName || null,
    }, {
      headers: buildInternalHeaders(userId),
      timeout: 5000,
    });

    const messageObj = response.data?.data || response.data;
    const messageJson = JSON.stringify(messageObj);

    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `msg-${messageObj._id || Date.now()}`,
    }, messageJson);

    deliverToUser(recipientId, '/user/queue/messages', messageJson);

    const receiptId = frame.headers['receipt'];
    if (receiptId) sendFrame(conn, 'RECEIPT', { 'receipt-id': receiptId });
  } catch (err) {
    logger.error('chat image proxy error', { error: err.message, userId });
    sendFrame(conn, 'ERROR', { 'message': 'Failed to send image' });
  }
}

async function handleChatRead(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { conversationId } = body;
    if (!conversationId) return;

    await axios.patch(`${CHAT_SERVICE_URL}/api/v1/chat/conversations/${conversationId}/read`, {}, {
      headers: buildInternalHeaders(userId),
      timeout: 5000,
    });

    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `read-${Date.now()}`,
    }, JSON.stringify({
      type: 'READ_ACK',
      conversationId,
      userId,
      readAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.error('chat read proxy error', { error: err.message, userId });
  }
}

function handleTyping(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { conversationId, isTyping } = body;
    if (!conversationId) return;

    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `typing-${Date.now()}`,
    }, JSON.stringify({
      type: isTyping ? 'TYPING_START' : 'TYPING_STOP',
      conversationId,
      userId,
    }), conn.id);
  } catch (err) {
    logger.error('typing indicator error', { error: err.message, userId });
  }
}

/**
 * Deliver a message to all connections of a specific user.
 */
function deliverToUser(userId, destination, body, excludeConnId) {
  const connIds = userSessions.get(String(userId));
  if (!connIds) return;

  for (const connId of connIds) {
    if (connId === excludeConnId) continue;
    const session = sessions.get(connId);
    if (!session) continue;

    for (const sub of session.subscriptions.values()) {
      if (sub.destination === destination) {
        sendFrame(session.conn, 'MESSAGE', {
          'destination': destination,
          'content-type': 'application/json',
          'message-id': `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        }, body);
      }
    }
  }
}
