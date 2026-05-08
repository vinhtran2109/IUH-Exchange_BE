import api from "./api";

export const wishlistService = {
  // Toggle wishlist (add/remove)
  toggle: async (productId: string) => {
    const response = await api.post(`/products/${productId}/wishlist`);
    return response.data;
  },

  // Check if product is wishlisted
  check: async (productId: string) => {
    const response = await api.get(`/products/${productId}/wishlist/check`);
    return response.data;
  },

  // Get user's wishlist
  getMyWishlist: async (page = 0, size = 20) => {
    const response = await api.get(`/products/me/wishlist?page=${page}&size=${size}`);
    return response.data;
  },
};
