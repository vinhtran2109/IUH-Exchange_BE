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

export interface ProductPayload {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  imageUrls: string[];
}

export const productService = {
  getProducts: async (page = 1, size = 20, category?: string, sort?: string) => {
    let url = `/products?page=${page}&size=${size}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (sort) url += `&sort=${encodeURIComponent(sort)}`;
    const response = await api.get(url);
    return response.data;
  },

  getMyProducts: async (page = 1, size = 10) => {
    const response = await api.get(`/products/me?page=${page}&size=${size}`);
    return response.data;
  },

  searchProducts: async (keyword: string, page = 1, size = 20) => {
    const response = await api.get(`/products/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`);
    return response.data;
  },

  getProductById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  createProduct: async (data: ProductPayload) => {
    const response = await api.post("/products", data);
    return response.data;
  },

  updateProduct: async (id: string, data: ProductPayload) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  getUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post("/products/upload-url", { filename, contentType });
    return response.data;
  },

  deleteProduct: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  }
};
