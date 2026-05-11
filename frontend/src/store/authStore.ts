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

export const useAuthStore = create<AuthState>()(
  (set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
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
        // console.log("📡 [AuthStore] Restoring session...");
        const res = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const user = res.data.data;
        // console.log("✅ [AuthStore] Session restored:", user.email);
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error: any) {
        // console.error("❌ [AuthStore] Restore failed:", error.response?.status);
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
