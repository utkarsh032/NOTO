import { ok } from '@noto/core';
import type { Result } from '@noto/types';

import { sha1HexUpper } from '../helpers/crypto';
import { fromProviderError } from '../helpers/errors';
import type { BreachCheckPort } from '../ports';

/**
 * Checking a password against Have I Been Pwned, without sending it anywhere.
 *
 * The k-anonymity range API takes the first five hex characters of the SHA-1
 * and returns every suffix sharing that prefix — some hundreds of hashes. The
 * match happens here, on our side. The password never leaves the process, and
 * the service learns only that somebody, somewhere, asked about one of roughly
 * 800 possible hashes.
 *
 * SHA-1 is not a mistake: the corpus is indexed by it. It is being used as a
 * lookup key against a public dataset, not to protect anything.
 */
export class HibpBreachCheck implements BreachCheckPort {
  constructor(
    private readonly options: {
      /** Overridable so tests never touch the network. */
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    } = {},
  ) {}

  async isBreached(password: string): Promise<Result<boolean>> {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 3000);

    try {
      const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
        signal: controller.signal,
        // Padding asks the service to return decoy hashes, so the response size
        // does not reveal how many real matches the prefix had.
        headers: { 'Add-Padding': 'true' },
      });

      if (!response.ok) {
        return fromProviderError(new Error(`status ${response.status}`), 'Breach check');
      }

      const body = await response.text();

      for (const line of body.split('\n')) {
        const [candidate, count] = line.trim().split(':');
        // A padded decoy has a count of zero and must not be treated as a hit.
        if (candidate === suffix && Number(count) > 0) return ok(true);
      }

      return ok(false);
    } catch (error) {
      return fromProviderError(error, 'Breach check');
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * A breach check that always says no.
 *
 * For local development and tests, where reaching a third party for every
 * password would be slow, flaky and rude. Never for production: the policy in
 * `AuthService` decides what to do when the real check is unavailable, and this
 * would lie to it rather than fail.
 */
export class NoBreachCheck implements BreachCheckPort {
  async isBreached(): Promise<Result<boolean>> {
    return ok(false);
  }
}
