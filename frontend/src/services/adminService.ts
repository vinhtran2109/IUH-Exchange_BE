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

export interface AuditLogData {
  _id: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  method: string;
  path: string;
  ip?: string | null;
  userAgent?: string | null;
  statusCode?: number | null;
  createdAt: string;
}

export interface AdminOrderData {
  _id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productTitle?: string;
  product?: { title?: string } | null;
  buyerName?: string;
  sellerName?: string;
  buyer?: { name?: string; studentId?: string } | null;
  seller?: { name?: string; studentId?: string } | null;
  price: number;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  disputeStatus?: string;
  disputeReason?: string;
  paymentIssueStatus?: string;
  paymentIssueReason?: string;
  cancellationCategory?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface ReportedMessageData {
  _id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  content: string;
  moderationStatus: string;
  reports?: Array<{ reportedBy: string; reason: string; createdAt: string }>;
  updatedAt: string;
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

  getUserProfile: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
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

  resolveReport: async (reportId: string, status: string, adminNote?: string, options: { skipKarmaPenalty?: boolean } = {}) => {
    const response = await api.patch(`/reports/admin/${reportId}/resolve`, {
      status,
      adminNote: adminNote || '',
      skipKarmaPenalty: Boolean(options.skipKarmaPenalty),
    });
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

  getLostFoundHeatmap: async (days = 30) => {
    const response = await api.get(`/lost-found/admin/heatmap?days=${days}`);
    return response.data;
  },

  bulkModerateLostFound: async (ids: string[], action: 'DELETE' | 'CLOSE') => {
    const response = await api.post('/lost-found/admin/bulk-moderate', { ids, action });
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

  getOrderStats: async () => {
    const response = await api.get('/orders/admin/stats');
    return response.data;
  },

  getAdminOrders: async (page = 1, size = 100, filters: { status?: string; paymentStatus?: string; disputeStatus?: string; paymentIssueStatus?: string } = {}) => {
    const params = new URLSearchParams({ page: String(Math.max(1, page)), size: String(size) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'ALL') params.set(key, value);
    });
    const response = await api.get(`/orders/admin?${params.toString()}`);
    return response.data;
  },

  resolveOrderDispute: async (
    orderId: string,
    status: 'RESOLVED' | 'REJECTED',
    resolution: string,
    outcome: 'SELLER_FAULT' | 'BUYER_FAULT' | 'BOTH_FAULT' | 'NO_FAULT' = 'NO_FAULT',
    remedy: 'NONE' | 'REFUND' = 'NONE'
  ) => {
    const response = await api.patch(`/orders/${orderId}/disputes/resolve`, { status, resolution, outcome, remedy });
    return response.data;
  },

  resolvePaymentIssue: async (orderId: string, action: 'CONFIRM_PAID' | 'REFUND' | 'REJECT', resolution: string) => {
    const response = await api.patch(`/orders/${orderId}/payment-issues/resolve`, { action, resolution });
    return response.data;
  },

  getReportedMessages: async (status = 'PENDING', page = 1, size = 100) => {
    const response = await api.get(`/chat/admin/reported-messages?status=${encodeURIComponent(status)}&page=${Math.max(1, page)}&size=${size}`);
    return response.data;
  },

  resolveReportedMessage: async (messageId: string, status: 'REVIEWED' | 'DISMISSED') => {
    const response = await api.patch(`/chat/admin/reported-messages/${messageId}/resolve`, { status });
    return response.data;
  },

  getAuditLogs: async (page = 1, size = 50, filters: { action?: string; userId?: string; resource?: string; method?: string } = {}) => {
    const validPage = Math.max(1, page);
    const params = new URLSearchParams({ page: String(validPage), size: String(size) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await api.get(`/users/admin/audit-logs?${params.toString()}`);
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
