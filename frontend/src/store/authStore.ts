import { create } from "zustand";

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

// Bug #25 fix: Don't persist user object to localStorage (XSS can steal auth data).
// Only keep in memory. Token stays in localStorage (separate).
export const useAuthStore = create<AuthState>()(
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
  })
);
