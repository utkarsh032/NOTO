import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '@noto/backend/postgres';

/**
 * argon2id, as GoTrue used (plan §1).
 *
 * The parameters are OWASP's first recommended set: 19 MiB, two passes, one
 * lane. The encoded hash carries them, so raising them later only affects new
 * hashes and every old one still verifies.
 */
const OPTIONS = {
  // Algorithm.Argon2id — a const enum, which verbatimModuleSyntax cannot import.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function createArgon2Hasher(): PasswordHasher {
  return {
    hash: (password) => hash(password, OPTIONS),
    async verify(encoded, password) {
      try {
        return await verify(encoded, password);
      } catch {
        // A malformed stored hash is a failed check, not a crash.
        return false;
      }
    },
  };
}
