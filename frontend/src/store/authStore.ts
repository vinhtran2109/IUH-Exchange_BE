import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  login: (user: User, accessToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user, accessToken) => {
        localStorage.setItem("accessToken", accessToken);
        set({ user, isAuthenticated: true });
      },
      updateUser: (updatedFields) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null
        }));
      },
      logout: () => {
        localStorage.removeItem("accessToken");
        set({ user: null, isAuthenticated: false });
      },
    }),

    {
      name: "auth-storage",
    }
  )
);
