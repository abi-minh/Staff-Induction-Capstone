import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { isTokenExpired } from '../util/jwt';

const BASE_URL =
  window.InductionApp?.restUrl ??
  import.meta.env.VITE_WP_REST_URL ??
  'http://localhost:8080/wp-json/';

export const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request.
//
// An expired token is not sent at all: the session ends here and the request is
// rejected locally. The 401 handler below would reach the same end state, but
// only after a round trip, and on a page that fires several queries at once
// that means several pointless authenticated requests against a WAF that counts
// them.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('induction_token');
  if (!token) return config;

  if (isTokenExpired(token)) {
    useAuthStore.getState().expireSession();
    return Promise.reject(new Error('Your session ended. Please sign in again.'));
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise errors; drop auth on 401.
//
// This must NEVER reload the page. WordPress answers 401 whenever the JWT is
// not accepted — an expired token, but equally an Authorization header stripped
// by a proxy or security plugin, or a cached response — and 403 when the token
// is fine but the capability is missing. Reloading on 401 turned any one of
// those into a loop: sign in, first portal query 401s, reload, sign in again.
// It also fired mid-submit on the login page, so the spinner froze on a
// painted card and looked like a browser hang.
//
// Clearing the store instead lets RequireAuth route to /login on the next
// render, with sessionExpired set so the user is told what happened.
client.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().expireSession();
    }
    const message = error.response?.data?.message ?? error.message ?? 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export default client;
