// Test-only helpers for building JWTs. Not a *.test.ts file, so vitest does not
// collect it, and nothing in the app imports it — it exists so the jwt and
// client suites share one token builder instead of keeping two copies in step.
//
// The encoder is hand-rolled for the same reason jwt.ts decodes by hand: the
// jsdom build used for tests has a btoa() that rejects even plain ASCII.

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlEncode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    out += BASE64URL[b0 >> 2];
    out += BASE64URL[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 !== undefined) out += BASE64URL[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 !== undefined) out += BASE64URL[b2 & 0b111111];
  }

  return out;
}

/** A token shaped like the ones jwt-auth issues. The signature is never read. */
export function tokenWith(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  return `${header}.${base64UrlEncode(payload)}.not-a-real-signature`;
}

/** A token that expires `seconds` from `now` (default: the current clock). */
export function tokenExpiringIn(seconds: number, now: number = Date.now()): string {
  return tokenWith({
    iss: 'https://example.test',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + seconds,
  });
}
