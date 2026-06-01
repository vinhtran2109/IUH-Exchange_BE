import sockjs from 'sockjs';
import jwt from 'jsonwebtoken';
import { config, logger, createRedis } from '@iuh-exchange/common';
import { ChatMessage } from '../models/ChatMessage.js';
import { FrameAccumulator, serializeFrame } from '../utils/stomp-parser.js';

const REDIS_NOTIF_CHANNEL = 'sockjs:notifications';

/**
 * Build a conversationId from two user IDs (sorted, joined by ":").
 */
export function buildConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join(':');
}

// ── Session & subscription tracking ──
// sessions: connId → { conn, subscriptions, authenticated, userId, userEmail }
const sessions = new Map();
// userSessions: userId → Set<connId>
const userSessions = new Map();

let redisPublisher = null;
let redisSubscriber = null;

/**
 * Send a STOMP frame to a specific SockJS connection.
 */
function sendFrame(conn, command, headers, body = '') {
  if (conn.readyState === 1) {
    conn.write(serializeFrame(command, headers, body));
  }
}

function sendPermissionError(conn, permission) {
  const permissionLabels = {
    CAN_CHAT: 'chat',
    CAN_REPORT: 'báo cáo',
  };
  sendFrame(conn, 'ERROR', {
    'message': 'Permission denied',
    'content-type': 'application/json',
  }, JSON.stringify({
    success: false,
    message: `Tài khoản của bạn chưa có quyền ${permissionLabels[permission] || permission}. Vui lòng kiểm tra điểm karma hoặc liên hệ admin.`,
    code: 'PERMISSION_DENIED',
    permission,
  }));
}

function hasPermission(sessionData, permission) {
  if (sessionData.userRole === 'ADMIN') return true;
  return Array.isArray(sessionData.permissions) && sessionData.permissions.includes(permission);
}

/**
 * Publish a notification to Redis for cross-instance delivery.
 */
export function publishNotification(notification) {
  if (!redisPublisher) return;
  try {
    redisPublisher.publish(REDIS_NOTIF_CHANNEL, JSON.stringify(notification));
  } catch (err) {
    logger.error('Failed to publish notification to Redis', { error: err.message });
  }
}

/**
 * Send a notification to a specific user via their WebSocket sessions.
 * Matches any /user/queue/* subscription (not just /user/queue/notifications)
 * so it works regardless of which destination the client subscribed to.
 */
export function sendNotificationToUser(userId, notification) {
  const connIds = userSessions.get(userId);
  if (!connIds || connIds.size === 0) return;

  for (const connId of connIds) {
    const sessionData = sessions.get(connId);
    if (!sessionData) continue;

    for (const sub of sessionData.subscriptions.values()) {
      // Match any /user/queue/* destination (notifications, messages, etc.)
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

/**
 * Broadcast a STOMP MESSAGE frame to all sessions subscribed to a destination.
 */
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
 *
 * @param {import('http').Server} httpServer
 * @returns {{ sockServer: Object, publishNotification: Function, sendNotificationToUser: Function }}
 */
export function initSocketService(httpServer) {
  const sockServer = sockjs.createServer({
    prefix: '/ws',
    sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',
    heartbeat_delay: 30000,
    disconnect_delay: 5000,
  });

  // ── Redis setup for multi-instance scaling ──
  redisPublisher = createRedis();
  redisSubscriber = createRedis();

  redisSubscriber.subscribe(REDIS_NOTIF_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to Redis notification channel', { error: err.message });
    } else {
      logger.info('Subscribed to Redis notification channel for cross-instance delivery');
    }
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel !== REDIS_NOTIF_CHANNEL) return;

    try {
      const notification = JSON.parse(message);
      const recipientId = String(notification.recipientId);
      sendNotificationToUser(recipientId, notification);
    } catch (err) {
      logger.error('Error processing Redis notification message', { error: err.message });
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
      userRole: null,
      permissions: [],
      heartbeatInterval: null,
      lastHeartbeatReceived: Date.now(),
    };

    sessions.set(conn.id, sessionData);

    conn.on('data', (message) => {
      // STOMP heartbeat from client: just a newline character
      if (message.trim() === '') {
        sessionData.lastHeartbeatReceived = Date.now();
        return;
      }

      // Bug #7 fix: Limit buffer size to prevent OOM attacks (1MB)
      const MAX_BUFFER_BYTES = 1 * 1024 * 1024;
      const msgBytes = Buffer.byteLength(message, 'utf8');
      if (!conn._totalBytes) conn._totalBytes = 0;
      conn._totalBytes += msgBytes;
      if (conn._totalBytes > MAX_BUFFER_BYTES) {
        logger.warn(`WebSocket buffer overflow, closing connection: ${conn.id}`);
        conn.close(3000, 'Buffer limit exceeded');
        return;
      }

      accumulator.push(message);

      while (accumulator.hasFrames()) {
        const frame = accumulator.nextFrame();
        if (!frame) break;

        // Track any STOMP activity as heartbeat evidence
        sessionData.lastHeartbeatReceived = Date.now();

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
            sendFrame(conn, 'ERROR', {
              'message': `Unknown STOMP command: ${frame.command}`,
              'content-type': 'text/plain',
            }, `Unsupported command: ${frame.command}`);
            break;
        }
      }
    });

    conn.on('close', () => {
      const data = sessions.get(conn.id);
      if (data) {
        if (data.heartbeatInterval) {
          clearInterval(data.heartbeatInterval);
          data.heartbeatInterval = null;
        }
        if (data.userId) {
          const conns = userSessions.get(data.userId);
          if (conns) {
            conns.delete(conn.id);
            if (conns.size === 0) {
              userSessions.delete(data.userId);
            }
          }
          logger.info(`Chat WS disconnected: ${data.userId}`);
        }
      }
      sessions.delete(conn.id);
    });
  });

  sockServer.installHandlers(httpServer, { prefix: '/ws' });

  // Bug #11 fix: Periodic cleanup of stale sessions every 60s
  const staleCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [connId, data] of sessions.entries()) {
      if (data.conn.readyState !== 1 && data.conn.readyState !== 0) {
        // Connection is closed/closing — clean up
        if (data.heartbeatInterval) {
          clearInterval(data.heartbeatInterval);
          data.heartbeatInterval = null;
        }
        if (data.userId) {
          const conns = userSessions.get(data.userId);
          if (conns) {
            conns.delete(connId);
            if (conns.size === 0) userSessions.delete(data.userId);
          }
        }
        sessions.delete(connId);
      }
    }
    logger.debug(`Session cleanup: ${sessions.size} sessions, ${userSessions.size} users`);
  }, 60_000);
  staleCleanupInterval.unref();

  logger.info('SockJS + STOMP server initialized on /ws');

  return { sockServer, publishNotification, sendNotificationToUser };
}

// ── STOMP command handlers ──

/**
 * Handle CONNECT/STOMP: authenticate user via JWT from headers.
 */
function handleConnect(conn, frame, sessionData) {
  const authHeader = frame.headers['Authorization'] || frame.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (authHeader) {
    token = authHeader;
  }

  if (!token) {
    sendFrame(conn, 'ERROR', {
      'message': 'Authentication required',
      'content-type': 'text/plain',
    }, 'Missing Authorization header in CONNECT frame');
    conn.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = String(decoded.sub || decoded.userId || decoded.id || '');

    if (!userId) {
      sendFrame(conn, 'ERROR', {
        'message': 'Invalid token: no user identity',
        'content-type': 'text/plain',
      }, 'Token does not contain user identity');
      conn.close();
      return;
    }

    sessionData.userId = userId;
    sessionData.userEmail = decoded.email || '';
    sessionData.userRole = decoded.role || 'STUDENT';
    sessionData.permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
    sessionData.authenticated = true;

    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Set());
    }
    userSessions.get(userId).add(conn.id);

    sendFrame(conn, 'CONNECTED', {
      'version': '1.1',
      'heart-beat': '25000,25000',
      'user-id': userId,
    });

    // Start STOMP heartbeat: send server heartbeat every 25s,
    // close connection if client heartbeat is missing for 60s.
    sessionData.lastHeartbeatReceived = Date.now();
    sessionData.heartbeatInterval = setInterval(() => {
      const elapsed = Date.now() - sessionData.lastHeartbeatReceived;
      if (elapsed > 60000) {
        logger.warn(`STOMP heartbeat timeout for user ${userId} (${elapsed}ms since last heartbeat)`);
        conn.close(3000, 'Heartbeat timeout');
        return;
      }
      // Send STOMP heartbeat to client
      try {
        conn.write('\n');
      } catch (_e) { /* connection may have closed */ }
    }, 25000);

    logger.info(`Chat WS connected: ${userId}`);
  } catch (err) {
    logger.warn('STOMP CONNECT auth failed', { error: err.message });
    sendFrame(conn, 'ERROR', {
      'message': 'Authentication failed',
      'content-type': 'text/plain',
    }, 'Invalid or expired token');
    conn.close();
  }
}

/**
 * Handle SUBSCRIBE: register a subscription for the session.
 */
function handleSubscribe(conn, frame, sessionData) {
  if (!sessionData.authenticated) {
    sendFrame(conn, 'ERROR', {
      'message': 'Not authenticated',
      'content-type': 'text/plain',
    }, 'Must CONNECT before SUBSCRIBE');
    return;
  }

  const destination = frame.headers['destination'];
  const subId = frame.headers['id'] || `sub-${Date.now()}`;

  if (!destination) {
    sendFrame(conn, 'ERROR', {
      'message': 'Missing destination header',
      'content-type': 'text/plain',
    }, 'SUBSCRIBE requires a destination header');
    return;
  }

  sessionData.subscriptions.set(subId, { id: subId, destination });

  logger.debug(`User ${sessionData.userId} subscribed to ${destination} [${subId}]`);
}

/**
 * Handle UNSUBSCRIBE: remove a subscription.
 */
function handleUnsubscribe(conn, frame, sessionData) {
  const subId = frame.headers['id'];
  if (subId) {
    sessionData.subscriptions.delete(subId);
  }
}

/**
 * Handle SEND: process application messages.
 */
function handleSend(conn, frame, sessionData) {
  if (!sessionData.authenticated) {
    sendFrame(conn, 'ERROR', {
      'message': 'Not authenticated',
      'content-type': 'text/plain',
    }, 'Must CONNECT before SEND');
    return;
  }

  const destination = frame.headers['destination'];
  const userId = sessionData.userId;

  if (destination === '/app/chat') {
    if (!hasPermission(sessionData, 'CAN_CHAT')) {
      sendPermissionError(conn, 'CAN_CHAT');
      return;
    }
    handleChatSend(conn, frame, userId);
  } else if (destination === '/app/chat.image') {
    if (!hasPermission(sessionData, 'CAN_CHAT')) {
      sendPermissionError(conn, 'CAN_CHAT');
      return;
    }
    handleChatImage(conn, frame, userId);
  } else if (destination === '/app/chat.read') {
    handleChatRead(conn, frame, userId);
  } else if (destination === '/app/typing') {
    handleTyping(conn, frame, userId);
  } else {
    sendFrame(conn, 'ERROR', {
      'message': `Unknown destination: ${destination}`,
      'content-type': 'text/plain',
    }, `No handler for destination: ${destination}`);
  }
}

/**
 * Process chat message send.
 */
async function handleChatSend(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { recipientId, content, conversationId: providedConvId, productContext } = body;

    if (content.length > 5000) {
      sendFrame(conn, 'ERROR', {
        'message': 'Validation failed',
        'content-type': 'application/json',
      }, JSON.stringify({
        success: false,
        message: 'Message content exceeds maximum length of 5000 characters',
      }));
      return;
    }

    if (!recipientId || !content || typeof content !== 'string' || content.trim().length === 0) {
      sendFrame(conn, 'ERROR', {
        'message': 'Validation failed',
        'content-type': 'application/json',
      }, JSON.stringify({
        success: false,
        message: 'recipientId and non-empty content are required',
      }));
      return;
    }

    const conversationId = providedConvId || buildConversationId(userId, recipientId);
    const safeProductContext = productContext?.id && productContext?.title
      ? {
          id: String(productContext.id).slice(0, 128),
          title: String(productContext.title).slice(0, 240),
          price: Number.isFinite(Number(productContext.price)) ? Number(productContext.price) : 0,
          imageUrl: productContext.imageUrl ? String(productContext.imageUrl).slice(0, 1000) : '',
        }
      : null;

    const message = await ChatMessage.create({
      senderId: userId,
      receiverId: recipientId,
      content: content.trim(),
      conversationId,
      ...(safeProductContext ? { messageType: 'PRODUCT_CONTEXT', productContext: safeProductContext } : {}),
    });

    const messageObj = message.toObject();
    const messageJson = JSON.stringify(messageObj);
    const receiptId = frame.headers['receipt'];

    // Deliver to all subscribers of the conversation topic
    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `msg-${messageObj._id}`,
    }, messageJson);

    // Deliver to recipient's private queue
    const recipientConnIds = userSessions.get(String(recipientId));
    if (recipientConnIds) {
      for (const connId of recipientConnIds) {
        const recipientSession = sessions.get(connId);
        if (!recipientSession) continue;

        for (const sub of recipientSession.subscriptions.values()) {
          if (sub.destination === '/user/queue/messages') {
            const recipientConn = recipientSession.conn;
            if (recipientConn) {
              sendFrame(recipientConn, 'MESSAGE', {
                'destination': '/user/queue/messages',
                'content-type': 'application/json',
                'message-id': `msg-${messageObj._id}`,
              }, messageJson);
            }
          }
        }
      }
    }

    // Also deliver to sender's other sessions (multi-tab support)
    const senderConnIds = userSessions.get(userId);
    if (senderConnIds) {
      for (const connId of senderConnIds) {
        if (connId === conn.id) continue;
        const senderSession = sessions.get(connId);
        if (!senderSession) continue;

        for (const sub of senderSession.subscriptions.values()) {
          if (sub.destination === '/user/queue/messages') {
            const senderConn = senderSession.conn;
            if (senderConn) {
              sendFrame(senderConn, 'MESSAGE', {
                'destination': '/user/queue/messages',
                'content-type': 'application/json',
                'message-id': `msg-${messageObj._id}`,
              }, messageJson);
            }
          }
        }
      }
    }

    // Send receipt to sender
    if (receiptId) {
      sendFrame(conn, 'RECEIPT', { 'receipt-id': receiptId });
    }
  } catch (err) {
    logger.error('chat send error', { error: err.message, userId });
    sendFrame(conn, 'ERROR', {
      'message': 'Failed to send message',
      'content-type': 'application/json',
    }, JSON.stringify({ success: false, message: 'Failed to send message' }));
  }
}

/**
 * Process image/file message send.
 */
async function handleChatImage(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { recipientId, fileUrl, fileName, conversationId: providedConvId } = body;

    if (!recipientId || !fileUrl) {
      sendFrame(conn, 'ERROR', {
        'message': 'Validation failed',
        'content-type': 'application/json',
      }, JSON.stringify({
        success: false,
        message: 'recipientId and fileUrl are required',
      }));
      return;
    }

    const conversationId = providedConvId || buildConversationId(userId, recipientId);

    const message = await ChatMessage.create({
      senderId: userId,
      receiverId: recipientId,
      content: fileName || 'Image',
      conversationId,
      messageType: 'IMAGE',
      fileUrl,
      fileName: fileName || null,
    });

    const messageObj = message.toObject();
    const messageJson = JSON.stringify(messageObj);
    const receiptId = frame.headers['receipt'];

    // Deliver to conversation topic
    broadcastToTopic(`/topic/chat/${conversationId}`, 'MESSAGE', {
      'destination': `/topic/chat/${conversationId}`,
      'content-type': 'application/json',
      'message-id': `msg-${messageObj._id}`,
    }, messageJson);

    // Deliver to recipient's private queue
    const recipientConnIds = userSessions.get(String(recipientId));
    if (recipientConnIds) {
      for (const connId of recipientConnIds) {
        const recipientSession = sessions.get(connId);
        if (!recipientSession) continue;
        for (const sub of recipientSession.subscriptions.values()) {
          if (sub.destination === '/user/queue/messages') {
            sendFrame(recipientSession.conn, 'MESSAGE', {
              'destination': '/user/queue/messages',
              'content-type': 'application/json',
              'message-id': `msg-${messageObj._id}`,
            }, messageJson);
          }
        }
      }
    }

    if (receiptId) {
      sendFrame(conn, 'RECEIPT', { 'receipt-id': receiptId });
    }
  } catch (err) {
    logger.error('chat image send error', { error: err.message, userId });
    sendFrame(conn, 'ERROR', {
      'message': 'Failed to send image',
      'content-type': 'application/json',
    }, JSON.stringify({ success: false, message: 'Failed to send image' }));
  }
}

/**
 * Process chat read acknowledgment.
 */
async function handleChatRead(conn, frame, userId) {
  try {
    const body = JSON.parse(frame.body);
    const { conversationId } = body;

    if (!conversationId) return;

    await ChatMessage.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { isRead: true },
    );

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
    logger.error('chat read error', { error: err.message, userId });
  }
}

/**
 * Process typing indicator.
 */
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
