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
  reportedUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

export const adminService = {
  // Users Management
  getAllUsers: async (page = 0, size = 20) => {
    const response = await api.get(`/users/admin/all?page=${page}&size=${size}`);
    return response.data;
  },

  toggleBanUser: async (userId: string) => {
    const response = await api.patch(`/users/admin/${userId}/toggle-ban`);
    return response.data;
  },

  // Reports Management
  getReports: async (status = "PENDING", page = 0, size = 20) => {
    const response = await api.get(`/reports/admin?status=${status}&page=${page}&size=${size}`);
    return response.data;
  },

  resolveReport: async (reportId: string, status: string, adminNote?: string) => {
    const response = await api.patch(`/reports/admin/${reportId}/resolve?status=${status}${adminNote ? `&adminNote=${encodeURIComponent(adminNote)}` : ''}`);
    return response.data;
  },

  // Product Moderation
  getPendingProducts: async (page = 0, size = 20) => {
    const response = await api.get(`/products/admin/pending?page=${page}&size=${size}`);
    return response.data;
  },

  resolveProductStatus: async (productId: string, action: 'APPROVE' | 'REJECT') => {
    const response = await api.patch(`/products/admin/${productId}/resolve?action=${action}`);
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
  }
};
