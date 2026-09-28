import { create } from 'zustand';
import type { AdminUser } from '../types';
import { isTokenExpired, msUntilExpiry } from '../util/jwt';

const TOKEN_KEY = 'induction_token';
const USER_KEY  = 'induction_user';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  // Set when a token we thought was good turns out not to be — either the
  // server rejected it, or its own exp claim has passed — so the login page can
  // say why the user is back there instead of silently reappearing.
  sessionExpired: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  clearAuth: () => void;
  expireSession: () => void;
}

/**
 * Restore the stored session, discarding it if the token has already expired.
 *
 * Without this check a stale token still looks like a session: RequireAuth
 * renders the portal, every query fires, and the user watches the app load and
 * then throw them out on the first 401. Reading the expiry locally means the
 * dead session never gets rendered at all.
 */
function loadFromStorage(): { token: string | null; user: AdminUser | null; expired: boolean } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    const user  = raw ? (JSON.parse(raw) as AdminUser) : null;

    if (token && isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // Only worth announcing if there was a session to lose. A stored token
      // with no user is a half-written session, not an expiry.
      return { token: null, user: null, expired: !!user };
    }

    return { token, user, expired: false };
  } catch {
    return { token: null, user: null, expired: false };
  }
}

const restored = loadFromStorage();

// Signing out the moment the token dies, rather than at the next click. A tab
// left open past expiry would otherwise sit there looking signed in until some
// request failed — and on a page that makes no requests while idle, that could
// be a long time.
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function cancelExpiryTimer(): void {
  if (expiryTimer !== undefined) {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
  }
}

function scheduleExpiry(token: string, onExpiry: () => void): void {
  cancelExpiryTimer();
  const ms = msUntilExpiry(token);
  // null means the expiry could not be read; there is nothing to schedule and
  // the server remains the backstop.
  if (ms === null) return;
  expiryTimer = setTimeout(onExpiry, ms);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: restored.token,
  user: restored.user,
  isAuthenticated: !!restored.token && !!restored.user,
  sessionExpired: restored.expired,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true, sessionExpired: false });
    scheduleExpiry(token, () => get().expireSession());
  },

  clearAuth: () => {
    cancelExpiryTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, sessionExpired: false });
  },

  // Same teardown as a deliberate sign-out, but flagged. Kept as its own
  // action so the 401 handler never has to touch localStorage and the store
  // separately — doing that is what left the two out of step and made a full
  // page reload look like the only way to recover.
  expireSession: () => {
    cancelExpiryTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, sessionExpired: true });
  },
}));

// A session restored from storage needs its timer too, not just one created by
// signing in.
if (restored.token) {
  scheduleExpiry(restored.token, () => useAuthStore.getState().expireSession());
}
