import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import api from './api';

export interface ChatMessage {
  id?: string;
  _id?: string;
  type?: string;
  senderId?: string;
  recipientId?: string;
  receiverId?: string;
  content?: string;
  timestamp?: string;
  isRead?: boolean;
  messageType?: string;
  fileUrl?: string;
  conversationId?: string;
  userId?: string;
  productContext?: ProductContext;
}

export interface PresenceEvent {
  type: 'PRESENCE_SNAPSHOT' | 'PRESENCE_ONLINE' | 'PRESENCE_OFFLINE';
  userId?: string;
  onlineUsers: string[];
  at: string;
}

let stompClient: Stomp.Client | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

const inferredSocketUrl =
  typeof window !== 'undefined'
    ? `http://${window.location.hostname}:8080/ws`
    : 'http://localhost:8080/ws';

const socketUrl = import.meta.env.VITE_WS_URL || inferredSocketUrl;
export interface ProductContext {
  id: string;
  title: string;
  price: number;
  imageUrl?: string;
}

let listeners: Array<(msg: ChatMessage) => void> = [];
let notificationListeners: Array<(notif: any) => void> = [];
let openChatListeners: Array<(recipientId: string, recipientName: string, product?: ProductContext) => void> = [];
let connectedListeners: Array<() => void> = [];
let errorListeners: Array<(message: string) => void> = [];

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

export const chatService = {
  addListener: (callback: (msg: ChatMessage) => void) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  },

  addNotificationListener: (callback: (notif: any) => void) => {
    notificationListeners.push(callback);
    return () => {
      notificationListeners = notificationListeners.filter((l) => l !== callback);
    };
  },

  addConnectedListener: (callback: () => void) => {
    connectedListeners.push(callback);
    if (stompClient?.connected) {
      callback();
    }
    return () => {
      connectedListeners = connectedListeners.filter((l) => l !== callback);
    };
  },

  addErrorListener: (callback: (message: string) => void) => {
    errorListeners.push(callback);
    return () => {
      errorListeners = errorListeners.filter((l) => l !== callback);
    };
  },

  onOpenChat: (callback: (id: string, name: string, product?: ProductContext) => void) => {
    openChatListeners.push(callback);
    return () => {
      openChatListeners = openChatListeners.filter((l) => l !== callback);
    };
  },

  triggerOpenChat: (id: string, name: string, product?: ProductContext) => {
    openChatListeners.forEach((l) => l(id, name, product));
  },

  buildConversationId: (userA: string, userB: string) => {
    return [userA, userB].sort().join(':');
  },

  connect: () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      chatService.disconnect();
      return;
    }

    if (stompClient?.connected || isConnecting) {
      return;
    }

    chatService._initNewConnection();
  },

  _initNewConnection: () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || isConnecting) return;

    clearReconnectTimer();
    isConnecting = true;

    const connectionUrl = `${socketUrl}?token=${encodeURIComponent(accessToken)}`;
    const socket = new SockJS(connectionUrl);
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    stompClient.connect({ Authorization: `Bearer ${accessToken}` }, (frame) => {
      isConnecting = false;
      console.log('[WebSocket] Real-time link established.', frame);

      if (!stompClient?.connected) return;

      stompClient.subscribe('/user/queue/messages', (payload) => {
        try {
          const message: ChatMessage = JSON.parse(payload.body);
          listeners.forEach((callback) => callback(message));
        } catch (e) {
          console.error('Error parsing private message:', e);
        }
      });

      stompClient.subscribe('/user/queue/notifications', (payload) => {
        try {
          const notification = JSON.parse(payload.body);
          notificationListeners.forEach((callback) => callback(notification));
        } catch (e) {
          console.error('Error parsing notification:', e);
        }
      });

      stompClient.subscribe('/topic/public', (payload) => {
        try {
          const message: ChatMessage = JSON.parse(payload.body);
          console.error('[PUBLIC RECEIVE] Message reached public channel unexpectedly.', message);
          listeners.forEach((callback) => callback(message));
        } catch (e) {
          console.error('Error parsing public message:', e);
        }
      });

      connectedListeners.forEach((callback) => callback());
    }, (error) => {
      isConnecting = false;
      console.error('WebSocket sync error:', error);
      let message = 'Không thể kết nối hoặc gửi tin nhắn.';
      const frame = typeof error === 'string' ? null : error;
      const headers = frame?.headers as { message?: string } | undefined;
      try {
        const rawBody = typeof frame?.body === 'string' ? frame.body : '';
        const parsed = rawBody ? JSON.parse(rawBody) as { message?: string } : null;
        message = parsed?.message || headers?.message || message;
      } catch {
        message = headers?.message || message;
      }
      errorListeners.forEach((callback) => callback(message));
      if (!localStorage.getItem('accessToken')) {
        chatService.disconnect();
        return;
      }
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        chatService.connect();
      }, 5000);
    });
  },

  disconnect: () => {
    clearReconnectTimer();
    isConnecting = false;
    if (stompClient && stompClient.connected) {
      try {
        stompClient.disconnect(() => {
          console.log('[WebSocket] Disconnected');
        });
      } catch (_err) {
        console.warn('Force cleaning up WebSocket connection');
      }
    }
    stompClient = null;
  },

  sendMessage: (message: ChatMessage) => {
    if (stompClient && stompClient.connected) {
      stompClient.send('/app/chat', {}, JSON.stringify(message));
      return true;
    }
    return false;
  },

  sendImage: (recipientId: string, fileUrl: string, fileName?: string) => {
    if (stompClient && stompClient.connected) {
      stompClient.send('/app/chat.image', {}, JSON.stringify({ recipientId, fileUrl, fileName }));
      return true;
    }
    return false;
  },

  sendTyping: (conversationId: string, isTyping: boolean) => {
    if (stompClient && stompClient.connected) {
      stompClient.send('/app/typing', {}, JSON.stringify({ conversationId, isTyping }));
      return true;
    }
    return false;
  },

  getChatUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post('/chat/upload-url', { filename, contentType });
    return response.data;
  },

  subscribeToConversation: (conversationId: string, callback: (msg: ChatMessage) => void) => {
    if (!conversationId) {
      return () => {};
    }

    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let subscribedClient: Stomp.Client | null = null;

    const subscribe = () => {
      if (!active || !stompClient?.connected) return;
      if (subscription && subscribedClient === stompClient) return;
      try {
        subscription?.unsubscribe();
      } catch (_error) {
        // ignore stale subscription cleanup errors
      }
      subscription = stompClient.subscribe(`/topic/chat/${conversationId}`, (payload) => {
        try {
          const message: ChatMessage = JSON.parse(payload.body);
          callback(message);
        } catch (error) {
          console.error('Error parsing conversation message:', error);
        }
      });
      subscribedClient = stompClient;
    };

    const removeConnectedListener = chatService.addConnectedListener(subscribe);
    subscribe();

    return () => {
      active = false;
      removeConnectedListener();
      try {
        subscription?.unsubscribe();
      } catch (_error) {
        // ignore unsubscribe cleanup errors
      }
      subscription = null;
      subscribedClient = null;
    };
  },

  subscribePresence: (callback: (event: PresenceEvent) => void) => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let subscribedClient: Stomp.Client | null = null;

    const subscribe = () => {
      if (!active || !stompClient?.connected) return;
      if (subscription && subscribedClient === stompClient) return;
      try {
        subscription?.unsubscribe();
      } catch (_error) {
        // ignore stale subscription cleanup errors
      }
      subscription = stompClient.subscribe('/topic/presence', (payload) => {
        try {
          callback(JSON.parse(payload.body));
        } catch (error) {
          console.error('Error parsing presence event:', error);
        }
      });
      subscribedClient = stompClient;
    };

    const removeConnectedListener = chatService.addConnectedListener(subscribe);
    subscribe();

    return () => {
      active = false;
      removeConnectedListener();
      try {
        subscription?.unsubscribe();
      } catch (_error) {
        // ignore unsubscribe cleanup errors
      }
      subscription = null;
      subscribedClient = null;
    };
  },

  getHistory: async (senderId: string, recipientId: string) => {
    const conversationId = [senderId, recipientId].sort().join(':');
    const response = await api.get(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  getConversations: async (_userId: string, page = 1, size = 15) => {
    const response = await api.get(`/chat/conversations?page=${page}&size=${size}`);
    return response.data;
  },

  searchMessages: async (query: string, conversationId?: string) => {
    let url = `/chat/search?q=${encodeURIComponent(query)}`;
    if (conversationId) url += `&conversationId=${encodeURIComponent(conversationId)}`;
    const response = await api.get(url);
    return response.data;
  },

  reportMessage: async (messageId: string, reason: string) => {
    const response = await api.post(`/chat/messages/${messageId}/report`, { reason });
    return response.data;
  },
};
