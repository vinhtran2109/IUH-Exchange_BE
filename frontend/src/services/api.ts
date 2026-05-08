import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = "http://localhost:8080/api/v1"; // API Gateway

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Inject Access Token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    const user = useAuthStore.getState().user;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (user?.id) {
      config.headers["X-User-Id"] = user.id;
    }

    if (user?.role) {
      config.headers["X-User-Role"] = user.role;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired token and automatic refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token is in httpOnly cookie — browser sends it automatically
        const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });
        const { accessToken } = res.data.data;

        localStorage.setItem("accessToken", accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
