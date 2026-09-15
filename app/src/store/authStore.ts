import { create } from 'zustand';
import type { AdminUser } from '../types';

const TOKEN_KEY = 'induction_token';
const USER_KEY  = 'induction_user';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  // Set when the server rejected a token we thought was good, so the login
  // page can say why the user is back there instead of silently reappearing.
  sessionExpired: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  clearAuth: () => void;
  expireSession: () => void;
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
  sessionExpired: false,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true, sessionExpired: false });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, sessionExpired: false });
  },

  // Same teardown as a deliberate sign-out, but flagged. Kept as its own
  // action so the 401 handler never has to touch localStorage and the store
  // separately — doing that is what left the two out of step and made a full
  // page reload look like the only way to recover.
  expireSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, sessionExpired: true });
  },
}));
