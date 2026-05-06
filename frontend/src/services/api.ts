import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = "http://localhost:8080/api/v1"; // API Gateway

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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

// Handle expired token and redirection
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // TODO: Implement Refresh Token logic here
      // const refreshToken = localStorage.getItem("refreshToken");
      // if (refreshToken) { ... }
    }

    return Promise.reject(error);
  }
);

export default api;
