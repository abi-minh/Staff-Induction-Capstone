// Reading the expiry out of the JWT so the app can end a dead session itself
// rather than waiting for the server to say 401.
//
// Nothing here verifies the token — that is the server's job and cannot be done
// in a browser. The signature is ignored entirely; the only claim read is `exp`,
// and only to decide when to stop using a token we already hold. A forged token
// gains nothing by lying about `exp`, because every request is still checked
// server-side.

/**
 * Treat a token as expired slightly early. A request that leaves with two
 * seconds of validity left arrives with none, and the round trip to staging is
 * routinely slower than that.
 */
const CLOCK_SKEW_MS = 30_000;

interface JwtClaims {
  exp?: number;
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Decode base64url to bytes, returning null for anything malformed.
 *
 * Hand-rolled rather than atob(). Two reasons, and the second is the one that
 * decided it: atob() yields a Latin1 binary string, so a claim containing any
 * non-ASCII character needs a second re-encoding step to survive; and the
 * jsdom build this project tests against has a broken atob() that rejects even
 * valid input, which would leave every path through here untestable.
 * TextDecoder is available in both browsers and Node and handles UTF-8 directly.
 */
function base64UrlToBytes(input: string): Uint8Array | null {
  const clean = input.replace(/=+$/, '');
  // A length of 4n+1 cannot come from any byte sequence.
  if (clean.length % 4 === 1) return null;

  const out = new Uint8Array((clean.length * 3) >> 2);
  let acc = 0;
  let bits = 0;
  let written = 0;

  for (const char of clean) {
    const value = BASE64URL.indexOf(char);
    if (value < 0) return null;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = (acc >> bits) & 0xff;
    }
  }

  return out.subarray(0, written);
}

function decodeClaims(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const bytes = base64UrlToBytes(parts[1]);
  if (bytes === null) return null;

  try {
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null ? (claims as JwtClaims) : null;
  } catch {
    return null;
  }
}

/** When this token stops being valid, in epoch milliseconds, or null if unknown. */
export function tokenExpiresAt(token: string): number | null {
  const exp = decodeClaims(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

/**
 * Whether a token should no longer be used.
 *
 * A token whose expiry cannot be read is reported as NOT expired, deliberately.
 * The alternative — assuming the worst — would sign everyone out the moment the
 * token format changed or a claim went missing, turning a cosmetic problem into
 * a lockout. The server still rejects anything genuinely invalid, and the 401
 * handler ends the session then.
 */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return false;
  return now >= expiresAt - CLOCK_SKEW_MS;
}

/**
 * Milliseconds until a token should be treated as expired, or null when that
 * cannot be determined. Never negative — an already-expired token returns 0 so
 * a caller scheduling a timer fires immediately rather than in the past.
 */
export function msUntilExpiry(token: string, now: number = Date.now()): number | null {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return null;
  return Math.max(0, expiresAt - CLOCK_SKEW_MS - now);
}
