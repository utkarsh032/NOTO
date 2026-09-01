/**
 * The small amount of cryptography the backend layer does itself.
 *
 * Everything here uses Web Crypto, which Node 20+, Deno, browsers, Electron and
 * Hermes all provide. No dependency, and the same code runs in an Edge Function
 * and on a device.
 */

/** Lowercase hex of a SHA-256 digest. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Uppercase hex of a SHA-1 digest. Used only for the breach check's range API. */
export async function sha1HexUpper(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * The subject key a rate limit counts against.
 *
 * The address is hashed before it is stored, because `auth_attempts` is not the
 * security log and has no reason to be able to identify anybody. A dump of that
 * table should not be a list of who has a Noto account.
 */
export async function rateLimitKey(kind: 'email' | 'ip', value: string): Promise<string> {
  if (kind === 'ip') return `ip:${value}`;

  return `email:${await sha256Hex(value.trim().toLowerCase())}`;
}

/** A random 32-byte value, hex-encoded. For PKCE verifiers and OAuth `state`. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The S256 challenge for a PKCE verifier, base64url-encoded. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Compares two strings in time that does not depend on where they differ.
 *
 * Used for `state` and token comparisons. A normal `===` returns as soon as it
 * finds a difference, which leaks the length of the matching prefix to anyone
 * willing to measure.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}
