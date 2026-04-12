import axios from 'axios';
import type { AdminUser } from '../types';

interface InductionAdminRuntime {
  nonce: string;
  restUrl: string;
  currentUser: AdminUser | null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

const fallbackRuntime: InductionAdminRuntime = {
  nonce: '',
  restUrl: import.meta.env.VITE_WP_REST_URL ?? 'http://localhost:8080/wp-json/',
  currentUser: {
    id: 0,
    name: 'Dev Admin',
    email: 'dev@example.com',
    roles: ['administrator'],
  },
};

const wpRuntime: InductionAdminRuntime = window.InductionAdmin ?? fallbackRuntime;

export const currentUser = wpRuntime.currentUser;
export const restUrl = ensureTrailingSlash(wpRuntime.restUrl);

const sharedConfig = {
  headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': wpRuntime.nonce,
  },
  withCredentials: true,
};

export const wpClient = axios.create({
  ...sharedConfig,
  baseURL: restUrl,
});

const client = axios.create({
  ...sharedConfig,
  baseURL: `${restUrl}induction/v1/`,
});

export default client;
