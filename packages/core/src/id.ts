import type { Id } from '@noto/types';

interface MinimalCrypto {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
}

function getCrypto(): MinimalCrypto | undefined {
  return (globalThis as { crypto?: MinimalCrypto }).crypto;
}

/**
 * Generates a UUID v4.
 *
 * Browsers, Node and Electron all expose `crypto.randomUUID`, but React Native's
 * JS runtime does not, so this degrades through `getRandomValues` and finally to
 * `Math.random`. Ids are only ever used for local identity and are always
 * combined with server-side keys before they reach the cloud, so the weakest
 * fallback is acceptable.
 */
export function createId(): Id {
  const crypto = getCrypto();

  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Stamp the version (4) and variant (10xx) bits required by RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex: string[] = [];
  for (const byte of bytes) {
    hex.push(byte.toString(16).padStart(2, '0'));
  }

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
