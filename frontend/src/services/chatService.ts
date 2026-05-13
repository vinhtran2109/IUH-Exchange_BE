import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import api from './api';

export interface ChatMessage {
  id?: string;
  senderId: string;
  recipientId: string;
  receiverId?: string;
  content: string;
  timestamp?: string;
  isRead?: boolean;
  messageType?: string;
  fileUrl?: string;
}

let stompClient: Stomp.Client | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const inferredSocketUrl =
  typeof window !== 'undefined'
    ? `http://${window.location.hostname}:8080/ws`
    : 'http://localhost:8080/ws';

const socketUrl = import.meta.env.VITE_WS_URL || inferredSocketUrl;
let listeners: Array<(msg: ChatMessage) => void> = [];
let notificationListeners: Array<(notif: any) => void> = [];
let openChatListeners: Array<(recipientId: string, recipientName: string) => void> = [];

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

  onOpenChat: (callback: (id: string, name: string) => void) => {
    openChatListeners.push(callback);
    return () => {
      openChatListeners = openChatListeners.filter((l) => l !== callback);
    };
  },

  triggerOpenChat: (id: string, name: string) => {
    openChatListeners.forEach((l) => l(id, name));
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

    if (stompClient && stompClient.connected) {
      stompClient.disconnect(() => {
        console.log('[WebSocket] Old connection closed. Establishing fresh real-time link...');
        chatService._initNewConnection();
      });
      return;
    }

    chatService._initNewConnection();
  },

  _initNewConnection: () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    clearReconnectTimer();

    const connectionUrl = `${socketUrl}?token=${encodeURIComponent(accessToken)}`;
    const socket = new SockJS(connectionUrl);
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    stompClient.connect({ Authorization: `Bearer ${accessToken}` }, (frame) => {
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
    }, (error) => {
      console.error('WebSocket sync error:', error);
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

  getChatUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post('/chat/upload-url', { filename, contentType });
    return response.data;
  },

  subscribeToConversation: (conversationId: string, callback: (msg: ChatMessage) => void) => {
    if (!stompClient || !stompClient.connected || !conversationId) {
      return () => {};
    }

    const subscription = stompClient.subscribe(`/topic/chat/${conversationId}`, (payload) => {
      try {
        const message: ChatMessage = JSON.parse(payload.body);
        callback(message);
      } catch (error) {
        console.error('Error parsing conversation message:', error);
      }
    });

    return () => {
      try {
        subscription.unsubscribe();
      } catch (_error) {
        // ignore unsubscribe cleanup errors
      }
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
};
