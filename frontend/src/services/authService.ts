import api from "./api";

export interface RegisterRequest {
  email: string;
  password?: string;
  name: string;
  studentId: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    studentId: string;
    role: string;
  };
}

export const authService = {
  login: async (data: LoginRequest) => {
    const response = await api.post("/auth/login", data);
    // Store refresh token for auto-refresh
    if (response.data?.success && response.data?.data?.refreshToken) {
      localStorage.setItem("refreshToken", response.data.data.refreshToken);
    }
    return response.data;
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  verifyOtp: async (email: string, otp: string) => {
    const response = await api.post("/auth/verify-otp", { email, otp });
    return response.data;
  },
};
