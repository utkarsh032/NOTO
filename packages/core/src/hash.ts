import type { DocumentContent } from '@noto/types';

/**
 * A fingerprint of a document body.
 *
 * Not cryptographic, and not meant to be: it answers "is this the same body as
 * before" for version history and sync, cheaply and synchronously on every
 * save, on every platform. Two 32-bit FNV-1a passes with different seeds give
 * 64 bits, which puts an accidental collision well out of reach for the number
 * of versions one document will ever have.
 *
 * The body is serialised with its keys sorted, so two objects that differ only
 * in key order — which the editor does not promise to keep — hash the same.
 */
export function hashContent(content: DocumentContent): string {
  const text = stableStringify(content);

  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01000193);
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';

  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);

  return `{${entries.join(',')}}`;
}
