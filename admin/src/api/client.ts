import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_WP_REST_URL ?? 'http://localhost:8080/wp-json/';

export const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT from localStorage on every request ───────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('induction_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — normalise errors, handle 401 ──────────────────────
client.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; code?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('induction_admin_token');
      localStorage.removeItem('induction_admin_user');
      // Reload so the app re-renders the login screen.
      window.location.reload();
    }
    const message = error.response?.data?.message ?? error.message ?? 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export default client;
