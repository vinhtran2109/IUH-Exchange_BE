import { create } from "zustand";
import api from "../services/api";

export interface User {
  [key: string]: any;
  id: string;
  email: string;
  studentId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  karmaPoint?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, accessToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  restoreAuth: () => Promise<void>;
}

// Bug #25 fix: Don't persist user object to localStorage (XSS can steal auth data).
// Only keep in memory. Token stays in localStorage (separate).
// restoreAuth() rehydrates user from token on app init (F5 refresh).
export const useAuthStore = create<AuthState>()(
  (set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true, // true until restoreAuth completes
    login: (user, accessToken) => {
      localStorage.setItem("accessToken", accessToken);
      set({ user, isAuthenticated: true, isLoading: false });
    },
    updateUser: (updatedFields) => {
      set((state) => ({
        user: state.user ? { ...state.user, ...updatedFields } : null
      }));
    },
    logout: () => {
      localStorage.removeItem("accessToken");
      set({ user: null, isAuthenticated: false, isLoading: false });
    },
    restoreAuth: async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        set({ isLoading: false });
        return;
      }
      try {
        const res = await api.get("/users/me");
        const user = res.data.data;
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error: any) {
        // Only clear token if it's actually invalid (401 or 403)
        // Don't clear on network errors or 5xx (server might be restarting)
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem("accessToken");
          set({ user: null, isAuthenticated: false, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      }
    },
  })
);
