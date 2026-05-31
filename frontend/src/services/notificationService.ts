import api from "./api";

export interface Notification {
  id: string;
  recipientId: string;
  title?: string;
  message: string;
  type: string; // ORDER, CHAT, SYSTEM, KARMA, REPORT, PRODUCT
  targetId?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const normalizeNotification = (notification: any): Notification => ({
  ...notification,
  id: notification?.id || notification?._id,
  isRead: Boolean(notification?.isRead),
  createdAt: notification?.createdAt || new Date().toISOString(),
});

export const notificationService = {
  // Lấy danh sách thông báo của tôi
  getNotifications: async () => {
    const response = await api.get('/notifications');
    const data = response.data;
    // Backend returns paginated { success, data: { content: [...] } }
    // Flatten for frontend compatibility
    if (data?.success && data?.data?.content) {
      return { success: true, data: data.data.content.map(normalizeNotification) };
    }
    if (data?.success && Array.isArray(data.data)) {
      return { ...data, data: data.data.map(normalizeNotification) };
    }
    return data;
  },

  // Đánh dấu 1 thông báo là đã đọc
  markAsRead: async (id: string) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  // Đánh dấu tất cả là đã đọc
  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  }
};
