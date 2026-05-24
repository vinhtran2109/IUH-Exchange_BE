import axios from "axios";

const inferredBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080/api/v1`
    : "http://localhost:8080/api/v1";

export const API_BASE_URL = import.meta.env.VITE_API_URL || inferredBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];
let refreshPromise: Promise<string> | null = null;
let lastRefreshFailure: { at: number; error: any } | null = null;

const REFRESH_RETRY_COOLDOWN_MS = 5000;

function shouldLogoutAfterRefreshFailure(error: any) {
  return [400, 401, 403].includes(error?.response?.status);
}

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  if (lastRefreshFailure && Date.now() - lastRefreshFailure.at < REFRESH_RETRY_COOLDOWN_MS) {
    return Promise.reject(lastRefreshFailure.error);
  }

  refreshPromise = axios
    .post(`${API_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true })
    .then((res) => {
      const { accessToken } = res.data.data;
      localStorage.setItem("accessToken", accessToken);
      lastRefreshFailure = null;
      return accessToken as string;
    })
    .catch((error) => {
      lastRefreshFailure = { at: Date.now(), error };
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (shouldLogoutAfterRefreshFailure(refreshError)) {
          localStorage.removeItem("accessToken");
          window.location.href = window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
