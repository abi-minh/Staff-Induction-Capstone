import axios from 'axios';
import type { AuthToken, AdminUser } from '../types';

const BASE_URL =
  window.InductionApp?.restUrl ??
  import.meta.env.VITE_WP_REST_URL ??
  'http://localhost:8080/wp-json/';

// Auth uses a plain axios instance (no token interceptor — this IS the login call).
const authClient = axios.create({ baseURL: BASE_URL });

interface JWTResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

export async function login(username: string, password: string): Promise<AuthToken> {
  const { data } = await authClient.post<JWTResponse>('jwt-auth/v1/token', {
    username,
    password,
  });
  return {
    token: data.token,
    userEmail: data.user_email,
    userNicename: data.user_nicename,
    userDisplayName: data.user_display_name,
  };
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    await authClient.post(
      'jwt-auth/v1/token/validate',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return true;
  } catch {
    return false;
  }
}

export async function fetchCurrentUser(token: string): Promise<AdminUser> {
  const { data } = await authClient.get<{
    id: number;
    name: string;
    email: string;
    roles: string[];
  }>('wp/v2/users/me', {
    params: { context: 'edit' },
    headers: { Authorization: `Bearer ${token}` },
  });
  return { id: data.id, name: data.name, email: data.email, roles: data.roles ?? [] };
}
