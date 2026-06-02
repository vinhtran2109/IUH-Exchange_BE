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
  adminOtp?: string;
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
    return response.data;
  },

  adminLogin: async (data: LoginRequest) => {
    const response = await api.post("/auth/login", data, {
      headers: {
        "X-Admin-Portal": "true",
        ...(data.adminOtp ? { "X-Admin-Otp": data.adminOtp } : {}),
      },
    });
    return response.data;
  },

  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  checkEmail: async (email: string) => {
    const response = await api.post("/auth/check-email", { email });
    return response.data;
  },

  verifyOtp: async (email: string, otp: string) => {
    const response = await api.post("/auth/verify-otp", { email, otp });
    return response.data;
  },
};
