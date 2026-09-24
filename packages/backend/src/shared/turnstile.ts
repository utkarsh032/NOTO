import { err, ok } from '@noto/core';
import type { Result } from '@noto/types';

import type { TurnstilePort } from '../ports/index.ts';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare Turnstile, verified server-side.
 *
 * The token the browser produces proves nothing on its own — anyone can post a
 * made-up string. It becomes evidence only when Cloudflare confirms it, which
 * is why this call cannot be skipped and cannot happen in the browser: the
 * secret that authorises it must never be shipped to a client.
 *
 * `action` and `hostname` are checked, not just `success`. Without those two, a
 * token minted by the same sitekey on a different form — or on a copy of the
 * page hosted somewhere else — would be accepted here.
 */
export class CloudflareTurnstile implements TurnstilePort {
  constructor(
    private readonly options: {
      secret: string;
      /** The `data-action` the widget was rendered with. */
      expectedAction: string;
      /** Frontend hostnames this deployment accepts. Never `localhost` in production. */
      expectedHostnames: string[];
      /** Overridable so tests never touch the network. */
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}

  async verify(token: string, remoteIp?: string): Promise<Result<boolean>> {
    if (token.length === 0 || token.length > 2048) {
      return err('invalid_input', 'Bot check failed. Try again.');
    }

    if (this.options.expectedHostnames.length === 0) {
      // Misconfiguration, not a bot. Failing closed is still the right answer:
      // an allow-list nobody set is an allow-list of everything.
      return err('storage_unavailable', 'The bot check is not configured.');
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);

    try {
      const response = await fetchImpl(SITEVERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
        body: new URLSearchParams({
          secret: this.options.secret,
          response: token,
          ...(remoteIp === undefined ? {} : { remoteip: remoteIp }),
        }),
      });

      if (!response.ok) return err('storage_unavailable', 'The bot check could not be reached.');

      const body = (await response.json()) as {
        success?: boolean;
        action?: string;
        hostname?: string;
        'error-codes'?: string[];
      };

      const passed =
        body.success === true &&
        body.action === this.options.expectedAction &&
        typeof body.hostname === 'string' &&
        this.options.expectedHostnames.includes(body.hostname);

      if (!passed) {
        /*
         * A bot and a misconfiguration are indistinguishable from outside: both
         * are a refused sign-up. They are not the same problem, though, and the
         * difference is only ever visible here.
         *
         * `invalid-input-secret` means the wrong secret is deployed and no
         * human can sign up at all. A mismatched action or hostname means the
         * token was minted somewhere this endpoint does not accept. Neither
         * contains anything a caller supplied, so both are safe to log.
         */
        console.warn(
          JSON.stringify({
            turnstile: 'rejected',
            errorCodes: body['error-codes'] ?? [],
            action: body.action,
            expectedAction: this.options.expectedAction,
            hostname: body.hostname,
            expectedHostnames: this.options.expectedHostnames,
          }),
        );
      }

      return ok(passed);
    } catch {
      // Network failure, timeout, or a body that was not JSON. Fail closed.
      return err('storage_unavailable', 'The bot check could not be reached.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Accepts everything. For tests and for a local stack with no Cloudflare
 * account — never for a deployment that is reachable from the internet.
 */
export class NoTurnstile implements TurnstilePort {
  verify(): Promise<Result<boolean>> {
    return Promise.resolve(ok(true));
  }
}
