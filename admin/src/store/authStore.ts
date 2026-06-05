import { create } from 'zustand';
import type { AdminUser } from '../types';

const TOKEN_KEY = 'induction_admin_token';
const USER_KEY  = 'induction_admin_user';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  clearAuth: () => void;
}

function loadFromStorage(): { token: string | null; user: AdminUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    const user  = raw ? (JSON.parse(raw) as AdminUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

const { token, user } = loadFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  token,
  user,
  isAuthenticated: !!token && !!user,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
