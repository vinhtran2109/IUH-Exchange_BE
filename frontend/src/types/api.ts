export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  studentId: string;
  avatarUrl?: string;
  bankInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    qrCodeUrl?: string;
  };
  karmaPoint: number;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
