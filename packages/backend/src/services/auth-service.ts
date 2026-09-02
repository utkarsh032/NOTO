import { err, ok } from '@noto/core';
import type { NotoError, Result } from '@noto/types';
import type { AuthSessionDto, SignInRequest, SignUpRequest } from '@noto/types/api';

import { rateLimitKey } from '../helpers/crypto.ts';
import { checkPassword, describeProblem } from '../helpers/password.ts';
import { validate } from '../helpers/validation.ts';
import type {
  AuthPort,
  AuditPort,
  DevicePort,
  RateLimitPort,
  TurnstilePort,
} from '../ports/index.ts';
import { signInSchema, signUpSchema } from '../schemas/index.ts';

/**
 * Signing in and signing up.
 *
 * All the policy lives here and none of the plumbing does: this class never
 * mentions Supabase, HTTP or SQL, which is why its rules can be tested without
 * any of them. What it owns is the order of operations, and the order is the
 * security property — rate limit before credentials, credentials before
 * device registration, and the same answer either way.
 */

/** How many failures inside the window before attempts are refused. */
export interface RateLimitPolicy {
  signInPerEmail: number;
  signInWindowSeconds: number;
  signUpPerIp: number;
  signUpWindowSeconds: number;
  resetPerEmail: number;
  resetWindowSeconds: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitPolicy = {
  signInPerEmail: 5,
  signInWindowSeconds: 15 * 60,
  signUpPerIp: 5,
  signUpWindowSeconds: 60 * 60,
  resetPerEmail: 3,
  resetWindowSeconds: 60 * 60,
};

export interface AuthServiceOptions {
  rateLimits?: RateLimitPolicy;
  /**
   * The floor on how long a sign-in attempt takes, in milliseconds.
   *
   * A wrong password fails in microseconds and a correct one costs a bcrypt
   * verification. Left alone, that difference tells an attacker which addresses
   * have accounts. Every attempt is padded to the same duration.
   */
  minimumAttemptMs?: number;
}

export class AuthService {
  private readonly rateLimits: RateLimitPolicy;
  private readonly minimumAttemptMs: number;

  constructor(
    private readonly ports: {
      auth: AuthPort;
      devices: DevicePort;
      audit: AuditPort;
      rateLimit: RateLimitPort;
      turnstile: TurnstilePort;
    },
    options: AuthServiceOptions = {},
  ) {
    this.rateLimits = options.rateLimits ?? DEFAULT_RATE_LIMITS;
    this.minimumAttemptMs = options.minimumAttemptMs ?? 250;
  }

  /**
   * Creates an account.
   *
   * The bot check runs first, then the length rule, before the provider is
   * touched at all. Refusing without creating anything is cheaper for us and
   * clearer for the person.
   */
  async signUp(input: unknown, context: { ip?: string } = {}): Promise<Result<AuthSessionDto>> {
    const parsed = validate(signUpSchema, input);
    if (!parsed.ok) return parsed;

    const request: SignUpRequest = parsed.value;

    if (context.ip) {
      const allowed = await this.underLimit(
        await rateLimitKey('ip', context.ip),
        'sign_up',
        this.rateLimits.signUpPerIp,
        this.rateLimits.signUpWindowSeconds,
      );
      if (!allowed.ok) return allowed;
    }

    /*
     * The bot check runs before the password rules, and before the provider is
     * touched at all. It is the cheapest of the three to fail and the only one
     * whose whole purpose is to stop work from happening.
     *
     * It fails closed: an unreachable bot check with an open door costs an
     * inbox full of accounts. It is now the only thing standing between this
     * endpoint and automated sign-ups.
     */
    const human = await this.ports.turnstile.verify(request.turnstileToken, context.ip);
    if (!human.ok) return human;
    if (!human.value) {
      await this.ports.audit.record({
        userId: null,
        kind: 'sign_up',
        outcome: 'failure',
        detail: { reason: 'bot_check_failed' },
      });

      return err('permission_denied', 'Bot check failed. Try again.');
    }

    const rejection = this.rejectUnusablePassword(request.password);
    if (rejection) return rejection;

    const created = await this.ports.auth.signUp({
      email: request.email,
      password: request.password,
      ...(request.displayName === undefined ? {} : { displayName: request.displayName }),
      ...(request.locale === undefined ? {} : { locale: request.locale }),
    });

    if (context.ip) {
      await this.ports.rateLimit.record(await rateLimitKey('ip', context.ip), 'sign_up');
    }

    return created;
  }

  /**
   * Signs in, and registers the device that did it.
   *
   * Every failure path returns the same error and takes the same time, whether
   * the address is unknown, the password is wrong or the account is locked.
   * There is no code for "no such account", because that is a free list of
   * targets for anyone who asks for it politely enough.
   */
  async signIn(input: unknown): Promise<Result<AuthSessionDto>> {
    const startedAt = Date.now();

    const parsed = validate(signInSchema, input);
    if (!parsed.ok) return parsed;

    const request: SignInRequest = parsed.value;
    const key = await rateLimitKey('email', request.email);

    const allowed = await this.underLimit(
      key,
      'sign_in',
      this.rateLimits.signInPerEmail,
      this.rateLimits.signInWindowSeconds,
    );
    if (!allowed.ok) {
      await this.padTo(startedAt);
      return allowed;
    }

    const session = await this.ports.auth.signIn({
      email: request.email,
      password: request.password,
    });

    if (!session.ok) {
      await this.ports.rateLimit.record(key, 'sign_in');
      await this.ports.audit.record({
        userId: null,
        kind: 'sign_in',
        outcome: 'failure',
        detail: { reason: 'invalid_credentials' },
      });
      await this.padTo(startedAt);

      return err('permission_denied', 'That email and password do not match an account.');
    }

    // The device is registered after authentication, never before: an
    // unauthenticated caller must not be able to write rows.
    const device = await this.ports.devices.upsert(session.value.user.id, request.device);
    if (!device.ok) {
      // Registration failing does not invalidate a correct sign-in. The account
      // screen will be missing a device; the person is still signed in, which
      // is what they asked for.
      await this.ports.audit.record({
        userId: session.value.user.id,
        kind: 'sign_in',
        outcome: 'success',
        detail: { deviceRegistration: 'failed' },
      });

      await this.padTo(startedAt);
      return session;
    }

    await this.ports.audit.record({
      userId: session.value.user.id,
      deviceId: device.value.id,
      kind: 'sign_in',
      outcome: 'success',
    });

    await this.padTo(startedAt);
    return session;
  }

  /**
   * Starts a password reset.
   *
   * Always reports success. Whether the address has an account is not something
   * this endpoint is willing to say, so the response is identical either way and
   * only the presence of an email in the inbox differs.
   */
  async requestPasswordReset(email: string): Promise<Result<void>> {
    const key = await rateLimitKey('email', email);

    const allowed = await this.underLimit(
      key,
      'reset',
      this.rateLimits.resetPerEmail,
      this.rateLimits.resetWindowSeconds,
    );
    if (!allowed.ok) return allowed;

    await this.ports.rateLimit.record(key, 'reset');
    await this.ports.auth.requestPasswordReset(email);

    return ok(undefined);
  }

  /** Changes a password, applying the same rules sign-up applies. */
  async updatePassword(input: {
    newPassword: string;
    signOutOtherDevices: boolean;
    email?: string;
    userId?: string;
  }): Promise<Result<void>> {
    const rejection = this.rejectUnusablePassword(input.newPassword);
    if (rejection) return rejection;

    const updated = await this.ports.auth.updatePassword({
      newPassword: input.newPassword,
      signOutOtherDevices: input.signOutOtherDevices,
    });

    if (updated.ok) {
      await this.ports.audit.record({
        userId: input.userId ?? null,
        kind: 'password_changed',
        outcome: 'success',
      });
    }

    return updated;
  }

  // -------------------------------------------------------------------------

  /**
   * Length, and nothing else. Returns a failure, or nothing.
   *
   * There is no guessability check on this path any more. A password in a
   * public breach corpus is accepted, and so is the account holder's own email
   * address as their password.
   */
  private rejectUnusablePassword(password: string): Result<never, NotoError> | null {
    const verdict = checkPassword(password);
    if (verdict.acceptable) return null;

    const first = verdict.problems[0];

    return err('invalid_input', first ? describeProblem(first) : 'That password cannot be used.');
  }

  private async underLimit(
    key: string,
    kind: string,
    limit: number,
    windowSeconds: number,
  ): Promise<Result<void>> {
    const count = await this.ports.rateLimit.countRecent(key, kind, windowSeconds);

    // A rate limiter that cannot be reached must not lock everybody out. The
    // request proceeds; the provider has its own limits behind this one.
    if (!count.ok) return ok(undefined);

    if (count.value >= limit) {
      return err('permission_denied', 'Too many attempts. Wait a few minutes before trying again.');
    }

    return ok(undefined);
  }

  /** Pads an attempt so its duration reveals nothing about its outcome. */
  private async padTo(startedAt: number): Promise<void> {
    const remaining = this.minimumAttemptMs - (Date.now() - startedAt);
    if (remaining <= 0) return;

    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
