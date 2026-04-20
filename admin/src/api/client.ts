import axios from 'axios';

// WordPress injects this object via wp_localize_script before the bundle loads.
// During local dev (outside WP), fall back to env vars so the dev server works.
const wpContext = window.InductionAdmin ?? {
  nonce: import.meta.env.VITE_WP_NONCE ?? '',
  restUrl: import.meta.env.VITE_WP_REST_URL ?? 'http://localhost:8080/wp-json/',
  currentUser: { id: 0, name: 'Dev Admin', email: '', roles: [] },
};

export const currentUser = wpContext.currentUser;
export const restUrl = wpContext.restUrl;



const client = axios.create({
  baseURL: restUrl,
    headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': wpContext.nonce,
  },
});

// Normalise WP REST errors into a consistent shape.
client.interceptors.response.use(
  (res) => res,
  (error) => {
    const message: string =
      error.response?.data?.message ?? error.message ?? 'An unknown error occurred';
    return Promise.reject(new Error(message));
  }
);

export default client;
