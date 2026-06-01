import api from "./api";

export const ItemType = {
  LOST: 'LOST',
  FOUND: 'FOUND'
} as const;

export type ItemType = typeof ItemType[keyof typeof ItemType];

export const ItemStatus = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  CLOSED: 'CLOSED'
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
  studentId: string;        // MSSV của người đăng tin
  userId?: string;
  userName?: string;
  status: ItemStatus;
  imageUrls: string[];
  createdAt: string;
  updatedAt?: string;

  // Câu hỏi xác minh quyền sở hữu — chủ item đặt ra để lọc claim
  // BUG FIX: Thiếu field này → TypeScript lỗi khi LostFoundDetail.tsx truy cập item.verificationQuestion
  verificationQuestion?: string;

  // Danh sách claim của item (trả về khi owner xem)
  claims?: Array<{
    id: string;
    claimantId: string;
    answer: string;
    evidenceUrls?: string[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    ownerNote?: string;
    createdAt: string;
    reviewedAt?: string;
  }>;

  // AI analysis fields — camelCase nhất quán với backend JSON response
  analysisStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  detectedType?: string;        // ← camelCase, KHÔNG phải detected_object (snake_case)
  analysisConfidence?: number;
  extracted?: {
    studentId?: string;         // ← camelCase, KHÔNG phải student_id
    text?: string;
  };

  // Consent flags
  consentImageAnalysis?: boolean;
  consentMssvExtraction?: boolean;
}



export interface ClaimPayload {
  /** Câu trả lời xác minh — bắt buộc, tối thiểu 2 ký tự (Zod schema yêu cầu) */
  answer: string;
  /** URL ảnh bằng chứng (tuỳ chọn, tối đa 5) */
  evidenceUrls?: string[];
}

export const lostFoundService = {
  // Lấy danh sách đồ thất lạc (Phân trang và lọc theo Loại)
  getItems: async (type: ItemType = ItemType.LOST, page = 1, size = 20) => {
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

  // Cập nhật tin
  updateItem: async (id: string, data: Partial<LostFoundItem>) => {
    const response = await api.put(`/lost-found/${id}`, data);
    return response.data;
  },

  // Xóa tin
  deleteItem: async (id: string) => {
    const response = await api.delete(`/lost-found/${id}`);
    return response.data;
  },

  /**
   * Xác nhận tìm thấy đồ — gửi câu trả lời xác minh cho chủ sở hữu.
   *
   * BUG FIX #2: Backend Zod schema yêu cầu `answer: z.string().min(2)`.
   * Gọi không có body sẽ bị BadRequestException "Required".
   */
  claimItem: async (id: string, payload: ClaimPayload) => {
    const response = await api.post(`/lost-found/${id}/claim`, payload);
    return response.data;
  },

  /**
   * Chủ sở hữu duyệt / từ chối claim.
   */
  reviewClaim: async (itemId: string, claimId: string, action: 'APPROVE' | 'REJECT', ownerNote?: string) => {
    const response = await api.post(`/lost-found/${itemId}/claims/${claimId}/review`, {
      action,
      ownerNote: ownerNote ?? '',
    });
    return response.data;
  },

  // Lấy Pre-signed URL để upload ảnh đồ thất lạc
  getUploadUrl: async (filename: string, contentType: string) => {
    const response = await api.post("/lost-found/upload-url", { filename, contentType });
    return response.data;
  },

  // Lấy danh sách matches cho một item
  getMatches: async (id: string, limit = 10, minScore = 0.15) => {
    const response = await api.get(`/lost-found/${id}/matches?limit=${limit}&minScore=${minScore}`);
    return response.data;
  },
};



