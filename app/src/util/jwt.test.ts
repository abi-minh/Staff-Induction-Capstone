import { describe, it, expect } from 'vitest';
import { isTokenExpired, msUntilExpiry, tokenExpiresAt } from './jwt';
import { tokenExpiringIn, tokenWith } from './jwt.fixtures';

const SECOND = 1000;
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

const expiringIn = (seconds: number) => tokenExpiringIn(seconds, NOW);

describe('tokenExpiresAt', () => {
  it('reads exp as epoch milliseconds', () => {
    expect(tokenExpiresAt(expiringIn(600))).to.eq(NOW + 600 * SECOND);
  });

  it('decodes a payload containing non-ASCII characters', () => {
    // A UTF-8-correct decode matters: mangling multi-byte characters makes
    // JSON.parse throw, which reads as "expiry unknown" for every token
    // belonging to a user with an accented name.
    const token = tokenWith({ name: 'Zoë Ngô — staff', exp: Math.floor(NOW / 1000) + 60 });
    expect(tokenExpiresAt(token)).to.eq(NOW + 60 * SECOND);
  });

  it('returns null when the expiry cannot be read', () => {
    expect(tokenExpiresAt('not-a-jwt')).to.eq(null);
    expect(tokenExpiresAt('only.two')).to.eq(null);
    expect(tokenExpiresAt('header.%%%not-base64%%%.sig'), 'payload is not base64url').to.eq(null);
    expect(tokenExpiresAt('header.YWJj.sig'), 'payload is not JSON').to.eq(null);
    expect(tokenExpiresAt(tokenWith({ iss: 'x' })), 'no exp claim').to.eq(null);
    expect(tokenExpiresAt(tokenWith({ exp: 'soon' })), 'exp is not a number').to.eq(null);
  });
});

describe('isTokenExpired', () => {
  it('is false for a token with time left', () => {
    expect(isTokenExpired(expiringIn(3600), NOW)).to.eq(false);
  });

  it('is true once exp has passed', () => {
    expect(isTokenExpired(expiringIn(-1), NOW)).to.eq(true);
  });

  // Expiring early on purpose: a request that leaves with a couple of seconds
  // left arrives with none.
  it('is true inside the clock-skew window, before exp itself', () => {
    expect(isTokenExpired(expiringIn(10), NOW)).to.eq(true);
    expect(isTokenExpired(expiringIn(29), NOW)).to.eq(true);
  });

  it('is false just outside the skew window', () => {
    expect(isTokenExpired(expiringIn(31), NOW)).to.eq(false);
  });

  // The important one. Assuming the worst about an unreadable token would sign
  // everyone out the moment the token format changed; the server is the
  // authority, and the 401 handler ends the session then.
  it('is false when the expiry cannot be determined', () => {
    expect(isTokenExpired('not-a-jwt', NOW)).to.eq(false);
    expect(isTokenExpired(tokenWith({ iss: 'x' }), NOW)).to.eq(false);
    expect(isTokenExpired('', NOW)).to.eq(false);
  });
});

describe('msUntilExpiry', () => {
  it('counts down to the skew-adjusted expiry', () => {
    expect(msUntilExpiry(expiringIn(600), NOW)).to.eq(600 * SECOND - 30 * SECOND);
  });

  it('is never negative, so a timer fires now rather than in the past', () => {
    expect(msUntilExpiry(expiringIn(-9999), NOW)).to.eq(0);
  });

  it('is null when there is nothing to schedule against', () => {
    expect(msUntilExpiry('not-a-jwt', NOW)).to.eq(null);
  });
});
