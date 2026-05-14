import api from "./api";

export interface UserAdminData {
  id: string;
  email: string;
  name: string;
  studentId: string;
  avatarUrl: string;
  isVerified: boolean;
  isActive: boolean;
  karmaPoint: number;
  role: string;
  permissions: string[];
}

export interface ReportData {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

export interface DlqEventData {
  _id: string;
  topic: string;
  key?: string;
  status: string;
  retryCount: number;
  payload?: unknown;
  createdAt: string;
}

export interface LostFoundAdminData {
  id: string;
  title: string;
  description?: string;
  type: 'LOST' | 'FOUND';
  status: string;
  location?: string;
  contactInfo?: string;
  studentId?: string;
  imageUrls?: string[];
  createdAt: string;
}

export const adminService = {
  // Users Management
  getAllUsers: async (page = 1, size = 20) => {
    const validPage = Math.max(1, page);
    const response = await api.get(`/users/admin/all?page=${validPage}&size=${size}`);
    return response.data;
  },

  toggleBanUser: async (userId: string) => {
    const response = await api.patch(`/users/admin/${userId}/toggle-ban`);
    return response.data;
  },

  deleteUser: async (userId: string) => {
    const response = await api.delete(`/users/admin/${userId}`);
    return response.data;
  },

  updateUserRole: async (userId: string, role: string) => {
    const response = await api.put(`/users/admin/${userId}/role`, { role });
    return response.data;
  },

  updateUserPermissions: async (userId: string, permissions: string[]) => {
    const response = await api.put(`/users/admin/${userId}/permissions`, { permissions });
    return response.data;
  },

  adjustKarma: async (userId: string, amount: number, reason?: string) => {
    const response = await api.put(`/users/admin/${userId}/karma`, { amount, reason });
    return response.data;
  },

  // Reports Management
  getReports: async (status = "ALL", page = 1, size = 20, targetType?: string) => {
    const validPage = Math.max(1, page);
    const params = new URLSearchParams({ page: String(validPage), size: String(size) });
    if (status && status !== 'ALL') params.set('status', status);
    if (targetType && targetType !== 'ALL') params.set('targetType', targetType);
    const response = await api.get(`/reports/admin?${params.toString()}`);
    return response.data;
  },

  resolveReport: async (reportId: string, status: string, adminNote?: string) => {
    const response = await api.patch(`/reports/admin/${reportId}/resolve?status=${status}${adminNote ? `&adminNote=${encodeURIComponent(adminNote)}` : ''}`);
    return response.data;
  },

  // Product Moderation
  getPendingProducts: async (page = 1, size = 20) => {
    const validPage = Math.max(1, page);
    const response = await api.get(`/products/admin/pending?page=${validPage}&size=${size}`);
    return response.data;
  },

  getAdminProducts: async (status = 'ALL', page = 1, size = 20) => {
    const validPage = Math.max(1, page);
    const response = await api.get(`/products/admin?status=${encodeURIComponent(status)}&page=${validPage}&size=${size}`);
    return response.data;
  },

  resolveProductStatus: async (productId: string, action: 'APPROVE' | 'REJECT') => {
    const response = await api.patch(`/products/admin/${productId}/resolve?action=${action}`);
    return response.data;
  },

  deleteProduct: async (productId: string) => {
    const response = await api.delete(`/products/admin/${productId}`);
    return response.data;
  },

  getProductDetail: async (productId: string) => {
    const response = await api.get(`/products/${productId}`);
    return response.data;
  },

  // Lost & Found Moderation
  getAdminLostFoundItems: async (type = 'ALL', status = 'ALL', page = 1, size = 20) => {
    const validPage = Math.max(1, page);
    const params = new URLSearchParams({ page: String(validPage), size: String(size) });
    if (type && type !== 'ALL') params.set('type', type);
    if (status && status !== 'ALL') params.set('status', status);
    const response = await api.get(`/lost-found/admin?${params.toString()}`);
    return response.data;
  },

  getLostFoundDetail: async (itemId: string) => {
    const response = await api.get(`/lost-found/${itemId}`);
    return response.data;
  },

  deleteLostFoundItem: async (itemId: string) => {
    const response = await api.delete(`/lost-found/admin/${itemId}`);
    return response.data;
  },

  // Stats
  getUserStats: async () => {
    const response = await api.get('/users/admin/stats');
    return response.data;
  },

  getProductStats: async () => {
    const response = await api.get('/products/admin/stats');
    return response.data;
  },

  // DLQ Monitoring
  getDlqEvents: async (page = 1, size = 20, status?: string) => {
    const validPage = Math.max(1, page);
    let url = `/notifications/dlq?page=${validPage}&size=${size}`;
    if (status) url += `&status=${status}`;
    const response = await api.get(url);
    return response.data;
  },

  retryDlqEvent: async (eventId: string) => {
    const response = await api.post(`/notifications/dlq/${eventId}/retry`);
    return response.data;
  },

  dismissDlqEvent: async (eventId: string) => {
    const response = await api.delete(`/notifications/dlq/${eventId}`);
    return response.data;
  },

  sendComposedEmail: async (payload: { to: string; subject: string; body: string }) => {
    const response = await api.post('/notifications/admin/email/compose', payload);
    return response.data;
  },
};
