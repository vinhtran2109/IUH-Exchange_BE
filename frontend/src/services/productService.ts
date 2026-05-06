import api from "./api";

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  imageUrls: string[];
  sellerId: string;
  status: string;
  createdAt: string;
}

export const productService = {
  // Lấy danh sách sản phẩm (mặc định page 0, size 20)
  getProducts: async (page = 0, size = 20) => {
    const response = await api.get(`/products?page=${page}&size=${size}`);
    return response.data;
  },

  // Xem các món đồ đã đăng của chính mình
  getMyProducts: async (page = 0, size = 10) => {
    const response = await api.get(`/products/me?page=${page}&size=${size}`);
    return response.data;
  },

  // Xem chi tiết 1 sản phẩm
  getProductById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  // Đăng bán sản phẩm mới
  createProduct: async (data: any) => {
    const response = await api.post("/products", data);
    return response.data;
  },

  // Lấy Pre-signed URL để upload ảnh lên S3
  getUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post("/products/upload-url", { filename, contentType });
    return response.data;
  },

  // 🗑️ Xóa sản phẩm rao bán
  deleteProduct: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  }
};

