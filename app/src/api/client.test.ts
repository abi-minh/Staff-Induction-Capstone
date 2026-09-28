import { beforeEach, describe, expect, it } from 'vitest';
import { client } from './client';
import { useAuthStore } from '../store/authStore';
import type { AdminUser } from '../types';
import { tokenExpiringIn } from '../util/jwt.fixtures';

// The 401 response interceptor. This exists as a regression test because the
// original implementation called window.location.reload() here, which turned a
// single rejected token into an unbreakable login loop: sign in, the first
// portal query 401s, the page reloads, sign in again. It also fired while the
// login button's spinner was up, so the reload froze a painted login card and
// was reported as the browser hanging.
//
// The contract is now: a 401 tears down the session in the store and nothing
// else. Routing back to /login is RequireAuth's job on the next render.

const STAFF: AdminUser = { id: 7, name: 'Test Staff', email: 's@example.test', roles: ['staff'] };

// Reject through the real interceptor chain by swapping the adapter, rather
// than reaching into client.interceptors.handlers.
function failWith(status: number, message = 'nope') {
  client.defaults.adapter = async () => {
    throw Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status, data: { message } },
    });
  };
}

function signedIn() {
  useAuthStore.setState({ token: 'a-valid-looking-token', user: STAFF, isAuthenticated: true, sessionExpired: false });
}

describe('client 401 handling', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, sessionExpired: false });
  });

  it('clears the session and flags it as expired', async () => {
    signedIn();
    failWith(401, 'Invalid token');

    await expect(client.get('induction/v1/me')).rejects.toThrow('Invalid token');

    const s = useAuthStore.getState();
    expect(s.token).toBe(null);
    expect(s.user).toBe(null);
    expect(s.isAuthenticated).toBe(false);
    expect(s.sessionExpired).toBe(true);
  });

  it('clears the persisted token too, so a refresh does not resurrect it', async () => {
    signedIn();
    localStorage.setItem('induction_token', 'a-valid-looking-token');
    localStorage.setItem('induction_user', JSON.stringify(STAFF));
    failWith(401);

    await expect(client.get('induction/v1/me')).rejects.toThrow();

    expect(localStorage.getItem('induction_token')).toBe(null);
    expect(localStorage.getItem('induction_user')).toBe(null);
  });

  // 403 is what WordPress returns when the token is fine but the capability is
  // missing — a staff account touching an admin endpoint. Signing them out for
  // that would be wrong, and it is a normal occurrence in this app.
  it('leaves the session alone on 403', async () => {
    signedIn();
    failWith(403, 'Sorry, you are not allowed to do that.');

    await expect(client.get('induction/v1/staff')).rejects.toThrow('Sorry, you are not allowed to do that.');

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.sessionExpired).toBe(false);
  });

  // A 401 with no token was never a session ending — there was no session.
  // Flagging one would show "your session ended" to a first-time visitor.
  it('does not flag an expired session when there was no token', async () => {
    failWith(401);

    await expect(client.get('induction/v1/me')).rejects.toThrow();

    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it('surfaces the server message, falling back to the axios one', async () => {
    failWith(500, 'Database is on fire');
    await expect(client.get('induction/v1/modules')).rejects.toThrow('Database is on fire');

    client.defaults.adapter = async () => {
      throw Object.assign(new Error('Network Error'), { isAxiosError: true });
    };
    await expect(client.get('induction/v1/modules')).rejects.toThrow('Network Error');
  });
});

// The request interceptor. An expired token is not worth a round trip: the
// session is ended locally and the request never leaves, which also keeps a
// page that fires several queries at once from throwing a burst of doomed
// authenticated requests at the WAF.
describe('client expired-token handling', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, sessionExpired: false });
    // Any response at all: a request that reaches the adapter has already
    // failed the point of these tests.
    client.defaults.adapter = async (config) => ({
      data: {}, status: 200, statusText: 'OK', headers: {}, config,
    });
  });

  it('refuses to send an expired token and ends the session', async () => {
    const token = tokenExpiringIn(-60);
    useAuthStore.setState({ token, user: STAFF, isAuthenticated: true, sessionExpired: false });
    localStorage.setItem('induction_token', token);

    await expect(client.get('induction/v1/me')).rejects.toThrow(/session ended/i);

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).to.eq(false);
    expect(s.sessionExpired).to.eq(true);
    expect(localStorage.getItem('induction_token')).to.eq(null);
  });

  it('still sends a token that has time left', async () => {
    const token = tokenExpiringIn(3600);
    useAuthStore.setState({ token, user: STAFF, isAuthenticated: true, sessionExpired: false });
    localStorage.setItem('induction_token', token);

    await expect(client.get('induction/v1/me')).resolves.toMatchObject({ status: 200 });
    expect(useAuthStore.getState().isAuthenticated).to.eq(true);
  });

  // An opaque token is the server's call, not ours.
  it('sends a token whose expiry cannot be read', async () => {
    localStorage.setItem('induction_token', 'opaque-token');
    await expect(client.get('induction/v1/me')).resolves.toMatchObject({ status: 200 });
    expect(useAuthStore.getState().sessionExpired).to.eq(false);
  });
});
