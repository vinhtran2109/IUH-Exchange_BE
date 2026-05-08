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
  // Lấy danh sách sản phẩm (mặc định page 1, size 20 — 1-based pagination)
  getProducts: async (page = 1, size = 20, category?: string, sort?: string) => {
    let url = `/products?page=${page}&size=${size}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (sort) url += `&sort=${encodeURIComponent(sort)}`;
    const response = await api.get(url);
    return response.data;
  },

  // Xem các món đồ đã đăng của chính mình
  getMyProducts: async (page = 1, size = 10) => {
    const response = await api.get(`/products/me?page=${page}&size=${size}`);
    return response.data;
  },

  // Tìm kiếm sản phẩm qua ElasticSearch
  searchProducts: async (keyword: string, page = 1, size = 20) => {
    const response = await api.get(`/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`);
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

