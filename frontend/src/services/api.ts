import axios from "axios";

const inferredBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/v1`
    : "http://localhost:8080/api/v1";

export const API_BASE_URL = import.meta.env.VITE_API_URL || inferredBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// ── Client-side Rate Limiter ──────────────────────────────────────────
// Bảo vệ server khỏi spam request từ phía client.
// Hoạt động song song với Server Rate Limiter ở API Gateway (defense-in-depth).

// Sliding Window Rate Limiter: tối đa 15 request trong 2 giây
const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_WINDOW = 15;
const WINDOW_SIZE_MS = 2000;

// Double-Submit Prevention: chặn bấm nút liên tục với cooldown 1.2s
const pendingMutations = new Map<string, number>();
const MUTATION_COOLDOWN_MS = 1200;

/**
 * BUG FIX #6: Dọn dẹp các entry quá hạn trong pendingMutations Map.
 * Không dùng setTimeout để xóa (dễ race condition) mà dọn chủ động
 * mỗi khi có request mutation mới để tránh Map phình to vô hạn.
 */
function cleanOldMutations(): void {
  const now = Date.now();
  for (const [key, ts] of pendingMutations.entries()) {
    if (now - ts > MUTATION_COOLDOWN_MS * 2) {
      pendingMutations.delete(key);
    }
  }
}

api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem("accessToken");
    const requestUrl = String(config.url || "");
    if (token && !requestUrl.includes("/auth/refresh-token") && isJwtExpiringSoon(token)) {
      try {
        token = await refreshAccessToken();
      } catch {
        // Let the response interceptor handle the final auth decision.
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const now = Date.now();

    // 1. Sliding Window Rate Limiter
    // Xóa các timestamp cũ ngoài cửa sổ 2 giây
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - WINDOW_SIZE_MS) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return Promise.reject(
        new Error("[ClientRateLimit] Bạn đang gửi yêu cầu quá nhanh. Vui lòng thao tác chậm lại.")
      );
    }
    requestTimestamps.push(now);

    // 2. Double-Submit Prevention cho các request thay đổi dữ liệu (POST/PUT/PATCH/DELETE)
    const { method, url, data } = config;
    if (method && ["post", "put", "delete", "patch"].includes(method.toLowerCase())) {
      cleanOldMutations(); // BUG FIX #6: dọn entry cũ trước khi kiểm tra

      // Key duy nhất theo method + url + payload
      const requestKey = `${method.toUpperCase()}:${url}:${JSON.stringify(data || {})}`;
      const lastSent = pendingMutations.get(requestKey);

      if (lastSent && now - lastSent < MUTATION_COOLDOWN_MS) {
        return Promise.reject(
          new Error("[DoubleSubmit] Yêu cầu đang được xử lý. Vui lòng không bấm liên tục!")
        );
      }
      // Ghi nhận thời điểm gửi — cleanOldMutations() sẽ tự dọn sau khi hết hạn
      pendingMutations.set(requestKey, now);
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
const TOKEN_REFRESH_SKEW_MS = 60000;

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof window === "undefined") return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function isJwtExpiringSoon(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + TOKEN_REFRESH_SKEW_MS;
}

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
