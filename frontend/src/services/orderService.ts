import api from "./api";

export interface CreateOrderRequest {
  productId: string;
  sellerId: string;
  price: number;
  buyerNote?: string;
  handoverLocation?: string;
  handoverTime?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'CASH';
  idempotencyKey: string;
  offerId?: string;
}

export interface PaymentCallbackPayload {
  transactionId: string;
  status: 'success' | 'failed';
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
    const response = await api.patch(`/orders/${id}/confirm`);
    return response.data;
  },

  rejectOrder: async (id: string, reason?: string) => {
    const response = await api.patch(`/orders/${id}/reject`, { reason });
    return response.data;
  },

  cancelOrder: async (id: string, reason?: string) => {
    const response = await api.patch(`/orders/${id}/cancel`, { reason });
    return response.data;
  },

  createPayment: async (id: string) => {
    const response = await api.post(`/orders/${id}/payment/create`, {});
    return response.data;
  },

  reportBankTransfer: async (id: string, payload: { proofUrl?: string; note?: string } = {}) => {
    const response = await api.post(`/orders/${id}/payment/bank-transfer/report`, payload);
    return response.data;
  },

  confirmBankTransfer: async (id: string, payload: { note?: string } = {}) => {
    const response = await api.post(`/orders/${id}/payment/bank-transfer/confirm`, payload);
    return response.data;
  },

  confirmPaymentCallback: async (id: string, payload: PaymentCallbackPayload) => {
    const response = await api.post(`/orders/${id}/payment/callback`, payload);
    return response.data;
  },

  getPaymentDetails: async (id: string) => {
    const response = await api.get(`/orders/${id}/payment`);
    return response.data;
  },

  refundPayment: async (id: string) => {
    const response = await api.post(`/orders/${id}/payment/refund`, {});
    return response.data;
  },

  openDispute: async (id: string, reason: string) => {
    const response = await api.post(`/orders/${id}/disputes`, { reason });
    return response.data;
  },

  addDisputeEvidence: async (id: string, payload: { type?: 'IMAGE' | 'CHAT_SCREENSHOT' | 'RECEIPT' | 'OTHER'; url: string; note?: string }) => {
    const response = await api.post(`/orders/${id}/disputes/evidence`, payload);
    return response.data;
  },

  proposeHandover: async (id: string, payload: { location: string; time: string; note?: string }) => {
    const response = await api.post(`/orders/${id}/handover/proposals`, payload);
    return response.data;
  },

  respondHandover: async (id: string, proposalId: string, action: 'ACCEPT' | 'REJECT') => {
    const response = await api.patch(`/orders/${id}/handover/proposals/${proposalId}`, { action });
    return response.data;
  },

  confirmHandover: async (id: string, payload: { code?: string; evidenceUrl?: string; note?: string } = {}) => {
    const response = await api.patch(`/orders/${id}/handover/confirm`, payload);
    return response.data;
  },

  reportNoShow: async (id: string, payload: { reason?: string; evidenceUrl?: string } = {}) => {
    const response = await api.post(`/orders/${id}/no-show`, payload);
    return response.data;
  },

  openPaymentIssue: async (id: string, reason: string) => {
    const response = await api.post(`/orders/${id}/payment-issues`, { reason });
    return response.data;
  },

  getReceipt: async (id: string) => {
    const response = await api.get(`/orders/${id}/receipt`);
    return response.data;
  },

  getAdminOrders: async (page = 1, size = 50, filters: { status?: string; paymentStatus?: string; disputeStatus?: string; paymentIssueStatus?: string } = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'ALL') params.set(key, value);
    });
    const response = await api.get(`/orders/admin?${params.toString()}`);
    return response.data;
  },

  getAdminStats: async () => {
    const response = await api.get('/orders/admin/stats');
    return response.data;
  },

  resolveDispute: async (id: string, status: 'RESOLVED' | 'REJECTED', resolution: string) => {
    const response = await api.patch(`/orders/${id}/disputes/resolve`, { status, resolution });
    return response.data;
  },

  resolvePaymentIssue: async (id: string, action: 'CONFIRM_PAID' | 'REFUND' | 'REJECT', resolution: string) => {
    const response = await api.patch(`/orders/${id}/payment-issues/resolve`, { action, resolution });
    return response.data;
  },
};
