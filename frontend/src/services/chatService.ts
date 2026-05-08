import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import api from './api';

export interface ChatMessage {
  id?: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp?: string;
  isRead?: boolean;
}

let stompClient: Stomp.Client | null = null;
const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';
let listeners: Array<(msg: ChatMessage) => void> = [];
let notificationListeners: Array<(notif: any) => void> = [];
let openChatListeners: Array<(recipientId: string, recipientName: string) => void> = [];

export const chatService = {
  // Đăng ký listener mới cho tin nhắn
  addListener: (callback: (msg: ChatMessage) => void) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },

  // Đăng ký listener cho notification real-time
  addNotificationListener: (callback: (notif: any) => void) => {
    notificationListeners.push(callback);
    return () => {
      notificationListeners = notificationListeners.filter(l => l !== callback);
    };
  },

  // Đăng ký listener cho lệnh mở chat
  onOpenChat: (callback: (id: string, name: string) => void) => {
    openChatListeners.push(callback);
    return () => {
      openChatListeners = openChatListeners.filter(l => l !== callback);
    };
  },

  // Phát tín hiệu mở chat
  triggerOpenChat: (id: string, name: string) => {
    openChatListeners.forEach(l => l(id, name));
  },

  // 1. Kết nối tới WebSocket
  connect: () => {
    if (stompClient && stompClient.connected) {
      stompClient.disconnect(() => {
        console.log('🔄 Old connection closed. Establishing fresh real-time link...');
        chatService._initNewConnection();
      });
    } else {
      chatService._initNewConnection();
    }
  },

  // Hàm nội bộ để khởi tạo kết nối
  _initNewConnection: () => {
    const socket = new SockJS(socketUrl);
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    const accessToken = localStorage.getItem('accessToken');
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    stompClient.connect(headers, (frame) => {
      console.warn('✅ [WebSocket] Real-time Link Established!', frame);
      
      if (stompClient?.connected) {
        // Subscribe vào hàng User Destination (Kênh riêng cho tin nhắn)
        stompClient.subscribe('/user/queue/messages', (payload) => {
          try {
            const message: ChatMessage = JSON.parse(payload.body);
            listeners.forEach(callback => callback(message));
          } catch (e) {
            console.error("❌ Error parsing private message:", e);
          }
        });

        // Subscribe vào notification queue (real-time notifications)
        stompClient.subscribe('/user/queue/notifications', (payload) => {
          try {
            const notification = JSON.parse(payload.body);
            notificationListeners.forEach(callback => callback(notification));
          } catch (e) {
            console.error("❌ Error parsing notification:", e);
          }
        });

        // [DEBUG] Subscribe vào kênh chung để kiểm tra đường truyền thô
        stompClient.subscribe('/topic/public', (payload) => {
          try {
            const message: ChatMessage = JSON.parse(payload.body);
            console.error("🔥 [PUBLIC RECEIVE] TIN NHẮN TỚI KÊNH CHUNG!", message);
            listeners.forEach(callback => callback(message));
          } catch (e) {
            console.error("❌ Error parsing public message:", e);
          }
        });
      }
    }, (error) => {
      console.error('❌ WebSocket Sync Error:', error);
      setTimeout(() => chatService.connect(), 5000);
    });
  },

  // 2. Ngắt kết nối
  disconnect: () => {
    if (stompClient && stompClient.connected) {
      try {
        stompClient.disconnect(() => {
          console.log('🔌 WebSocket Disconnected');
        });
      } catch (err) {
        console.warn('⚠️ Force cleaning up connection');
      }
    }
    stompClient = null;
  },

  // 3. Gửi tin nhắn
  sendMessage: (message: ChatMessage) => {
    if (stompClient && stompClient.connected) {
      stompClient.send('/app/chat', {}, JSON.stringify(message));
      return true;
    }
    return false;
  },

  // 4. Lấy lịch sử chat (dùng conversationId format: "userA:userB")
  getHistory: async (senderId: string, recipientId: string) => {
    const conversationId = [senderId, recipientId].sort().join(':');
    const response = await api.get(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  // 5. Lấy danh sách Inbox (các UserId đã từng chat)
  getConversations: async (_userId: string) => {
    const response = await api.get('/chat/conversations');
    return response.data;
  }
};
