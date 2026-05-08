import api from "./api";

export interface CreateOrderRequest {
  productId: string;
  sellerId: string;
  price: number;
  buyerNote?: string;
  idempotencyKey: string;
}

export const orderService = {
  createOrder: async (data: CreateOrderRequest) => {
    const response = await api.post("/orders", data, {
      headers: { 'Idempotency-Key': data.idempotencyKey },
    });
    return response.data;
  },

  getMyOrders: async () => {
    const response = await api.get("/orders/my-orders");
    return response.data;
  },

  getOrderById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  confirmOrder: async (id: string) => {
    const response = await api.post(`/orders/${id}/confirm`);
    return response.data;
  },

  rejectOrder: async (id: string, reason?: string) => {
    const response = await api.patch(`/orders/${id}/reject`, { reason });
    return response.data;
  }
};
