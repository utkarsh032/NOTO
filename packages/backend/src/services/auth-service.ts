import { err, ok } from '@noto/core';
import type { NotoError, Result } from '@noto/types';
import type { AuthSessionDto, SignInRequest, SignUpRequest } from '@noto/types/api';

import { rateLimitKey } from '../helpers/crypto';
import { checkPassword, describeProblem } from '../helpers/password';
import { validate } from '../helpers/validation';
import type { AuthPort, AuditPort, BreachCheckPort, DevicePort, RateLimitPort } from '../ports';
import { signInSchema, signUpSchema } from '../schemas';

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

export interface PasswordPolicy {
  /**
   * What to do when the breach service cannot be reached.
   *
   * `allow` by default. Refusing every sign-up because a third party is down
   * would turn their outage into ours, and the password is still subject to
   * every local rule. `deny` is available for a deployment that would rather
   * fail closed.
   */
  onBreachCheckUnavailable: 'allow' | 'deny';
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  onBreachCheckUnavailable: 'allow',
};

export interface AuthServiceOptions {
  rateLimits?: RateLimitPolicy;
  passwordPolicy?: PasswordPolicy;
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
  private readonly passwordPolicy: PasswordPolicy;
  private readonly minimumAttemptMs: number;

  constructor(
    private readonly ports: {
      auth: AuthPort;
      devices: DevicePort;
      audit: AuditPort;
      rateLimit: RateLimitPort;
      breachCheck: BreachCheckPort;
    },
    options: AuthServiceOptions = {},
  ) {
    this.rateLimits = options.rateLimits ?? DEFAULT_RATE_LIMITS;
    this.passwordPolicy = options.passwordPolicy ?? DEFAULT_PASSWORD_POLICY;
    this.minimumAttemptMs = options.minimumAttemptMs ?? 250;
  }

  /**
   * Creates an account.
   *
   * The password is checked twice — locally, then against known breaches —
   * before the provider is touched at all. Refusing a bad password without
   * creating anything is cheaper for us and clearer for the person.
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

    const rejection = await this.rejectUnusablePassword(request.password, request.email);
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
    const rejection = await this.rejectUnusablePassword(input.newPassword, input.email);
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

  /** Local rules, then the breach corpus. Returns a failure, or nothing. */
  private async rejectUnusablePassword(
    password: string,
    email?: string,
  ): Promise<Result<never, NotoError> | null> {
    const verdict = checkPassword(password, email);

    if (!verdict.acceptable) {
      const first = verdict.problems[0];
      return err('invalid_input', first ? describeProblem(first) : 'That password cannot be used.');
    }

    const breached = await this.ports.breachCheck.isBreached(password);

    if (!breached.ok) {
      return this.passwordPolicy.onBreachCheckUnavailable === 'deny'
        ? err('storage_unavailable', 'Could not check that password right now. Try again shortly.')
        : null;
    }

    if (breached.value) {
      return err(
        'invalid_input',
        'That password has appeared in a public data breach, so it is already being guessed. Choose another.',
      );
    }

    return null;
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
