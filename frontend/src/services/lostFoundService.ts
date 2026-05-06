import api from "./api";

export const ItemType = {
  LOST: 'LOST',
  FOUND: 'FOUND'
} as const;

export type ItemType = typeof ItemType[keyof typeof ItemType];

export const ItemStatus = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED'
} as const;

export type ItemStatus = typeof ItemStatus[keyof typeof ItemStatus];

export interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  type: ItemType;
  category: string;
  location: string;
  contactInfo: string;
  studentId: string;
  status: ItemStatus;
  imageUrls: string[];
  createdAt: string;
}



export const lostFoundService = {
  // Lấy danh sách đồ thất lạc (Phân trang và lọc theo Loại)
  getItems: async (type: ItemType = ItemType.LOST, page = 0, size = 20) => {
    const response = await api.get(`/lost-found?type=${type}&page=${page}&size=${size}`);
    return response.data;
  },

  // Lấy chi tiết một món đồ
  getItemById: async (id: string) => {
    const response = await api.get(`/lost-found/${id}`);
    return response.data;
  },

  // Đăng tin mới
  createItem: async (data: Partial<LostFoundItem>) => {
    const response = await api.post("/lost-found", data);
    return response.data;
  },

  // Xóa tin
  deleteItem: async (id: string) => {
    const response = await api.delete(`/lost-found/${id}`);
    return response.data;
  },

  // Lấy Pre-signed URL để upload ảnh đồ thất lạc
  getUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post("/lost-found/upload-url", { filename, contentType });
    return response.data;
  }
};


