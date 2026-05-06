import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = 'http://localhost:8080';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Add Auth Token and User-Id header
client.interceptors.request.use(
  (config) => {
    const { accessToken, user } = useAuthStore.getState();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    if (user?.studentId) {
      config.headers['X-User-Id'] = user.studentId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token refresh or logout on 401
client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken, clearAuth, setAuth } = useAuthStore.getState();
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { 
            refreshToken 
          });
          
          const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } = response.data.data;
          
          setAuth(user, newAccessToken, newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          clearAuth();
          return Promise.reject(refreshError);
        }
      } else {
        clearAuth();
      }
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

export default client;
