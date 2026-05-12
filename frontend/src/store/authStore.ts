import { create } from "zustand";
import api, { refreshAccessToken } from "../services/api";

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

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: (user, accessToken) => {
    localStorage.setItem("accessToken", accessToken);
    set({ user, isAuthenticated: true, isLoading: false });
  },
  updateUser: (updatedFields) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updatedFields } : null,
    }));
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
  restoreAuth: async () => {
    let token = localStorage.getItem("accessToken");

    try {
      if (!token) {
        token = await refreshAccessToken();
      }

      const res = await api.get("/users/me");
      const user = res.data.data;
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("accessToken");
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
