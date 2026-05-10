import api from "./api";

export interface Review {
  id: string;
  productId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewResponse {
  content: Review[];
  avgRating: number;
  totalReviews: number;
  totalPages: number;
  totalElements: number;
}

export const reviewService = {
  // Get reviews for a product
  getProductReviews: async (productId: string, page = 1, size = 10) => {
    const response = await api.get(`/products/${productId}/reviews?page=${page}&size=${size}`);
    return response.data;
  },

  // Create a review
  createReview: async (productId: string, data: { rating: number; comment: string; orderId: string }) => {
    const response = await api.post(`/products/${productId}/reviews`, data);
    return response.data;
  },

  // Check if review exists for an order
  checkReview: async (productId: string, orderId: string) => {
    const response = await api.get(`/products/${productId}/reviews/check?orderId=${orderId}`);
    return response.data;
  },

  // Get reviews for a seller
  getSellerReviews: async (userId: string, page = 1, size = 10) => {
    const response = await api.get(`/products/seller/${userId}/reviews?page=${page}&size=${size}`);
    return response.data;
  },
};
