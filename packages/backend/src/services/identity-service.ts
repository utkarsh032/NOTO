import { err, ok } from '@noto/core';
import type { NotoError, Result } from '@noto/types';
import type { AuthSessionDto, SessionDto, UserDto } from '@noto/types/api';

import { rateLimitKey } from '../helpers/crypto.ts';
import { checkPassword, describeProblem } from '../helpers/password.ts';
import { validate } from '../helpers/validation.ts';
import type {
  AuditPort,
  AuthPort,
  CallerIdentity,
  IdentityPort,
  RateLimitPort,
} from '../ports/index.ts';
import {
  emailChangeSchema,
  emailOnlySchema,
  emailTokenSchema,
  passwordChangeSchema,
  passwordResetConfirmSchema,
  refreshSchema,
} from '../schemas/index.ts';

/**
 * The identity flows a server owns: sessions, mailed tokens, password changes.
 *
 * `AuthService` covers signing up and signing in, which every backend has. This
 * covers what GoTrue used to do out of sight and the Noto API now does itself.
 * Same shape as its sibling: validation, rate limits and the security log here,
 * storage behind `IdentityPort`, and no HTTP, SQL or vendor anywhere.
 */

export interface IdentityRateLimits {
  /** Verification mails per address. The plan's "3 per hour per address". */
  resendPerEmail: number;
  resendWindowSeconds: number;
  resetPerEmail: number;
  /** Reset requests from one address, across every account. */
  resetPerIp: number;
  resetWindowSeconds: number;
  /** Wrong current-password guesses against one account, while signed in. */
  passwordChecksPerUser: number;
  passwordCheckWindowSeconds: number;
}

export const DEFAULT_IDENTITY_RATE_LIMITS: IdentityRateLimits = {
  resendPerEmail: 3,
  resendWindowSeconds: 60 * 60,
  resetPerEmail: 3,
  resetPerIp: 20,
  resetWindowSeconds: 60 * 60,
  passwordChecksPerUser: 5,
  passwordCheckWindowSeconds: 15 * 60,
};

const UNKNOWN_IP = 'unknown';

export class IdentityService {
  private readonly limits: IdentityRateLimits;

  constructor(
    private readonly ports: {
      auth: AuthPort;
      identity: IdentityPort;
      audit: AuditPort;
      rateLimit: RateLimitPort;
    },
    options: { rateLimits?: IdentityRateLimits } = {},
  ) {
    this.limits = options.rateLimits ?? DEFAULT_IDENTITY_RATE_LIMITS;
  }

  /** The caller behind an access token, or `null`. */
  authenticate(accessToken: string): Promise<Result<CallerIdentity | null>> {
    return this.ports.identity.authenticate(accessToken);
  }

  /** The signed-in user. `not_found` if the account has gone since the token was issued. */
  async currentUser(): Promise<Result<UserDto>> {
    const user = await this.ports.auth.currentUser();
    if (!user.ok) return user;

    return user.value ? ok(user.value) : err('not_found', 'That account no longer exists.');
  }

  /**
   * Exchanges a refresh token for a new pair.
   *
   * When the adapter reports the token was already rotated — two parties hold
   * it — every session is already gone. What is left to do here is make sure
   * the owner can see it happened.
   */
  async refresh(input: unknown): Promise<Result<AuthSessionDto>> {
    const parsed = validate(refreshSchema, input);
    if (!parsed.ok) return parsed;

    const refreshed = await this.ports.auth.refresh(parsed.value.refreshToken);

    if (!refreshed.ok) {
      const cause = (refreshed.error.cause ?? {}) as { code?: string; userId?: string };

      if (cause.code === 'refresh_token_reused') {
        await this.ports.audit.record({
          userId: cause.userId ?? null,
          kind: 'session_reuse_detected',
          outcome: 'failure',
          detail: { action: 'signed_out_everywhere' },
        });
      }
    }

    return refreshed;
  }

  async signOut(caller: CallerIdentity): Promise<Result<void>> {
    const ended = await this.ports.auth.signOut();
    if (!ended.ok) return ended;

    await this.ports.audit.record({
      userId: caller.userId,
      deviceId: caller.deviceId,
      kind: 'sign_out',
      outcome: 'success',
    });

    return ok(undefined);
  }

  async signOutAll(caller: CallerIdentity): Promise<Result<void>> {
    const ended = await this.ports.identity.signOutAll(caller.userId);
    if (!ended.ok) return ended;

    await this.ports.audit.record({
      userId: caller.userId,
      deviceId: caller.deviceId,
      kind: 'sign_out',
      outcome: 'success',
      detail: { scope: 'everywhere' },
    });

    return ok(undefined);
  }

  /** The caller's sessions, with the one making this request marked. */
  async listSessions(caller: CallerIdentity): Promise<Result<SessionDto[]>> {
    const sessions = await this.ports.identity.listSessions(caller.userId);
    if (!sessions.ok) return sessions;

    return ok(
      sessions.value.map((session) => ({ ...session, isCurrent: session.id === caller.sessionId })),
    );
  }

  /** Ends one of the caller's other sessions. Their own is ended by signing out. */
  async revokeSession(caller: CallerIdentity, sessionId: string): Promise<Result<void>> {
    if (sessionId === caller.sessionId) {
      return err('invalid_input', 'That is this session. Use "Sign out" instead.');
    }

    const ended = await this.ports.identity.signOutSession(caller.userId, sessionId);
    if (!ended.ok) return ended;

    await this.ports.audit.record({
      userId: caller.userId,
      deviceId: caller.deviceId,
      kind: 'sign_out',
      outcome: 'success',
      detail: { scope: 'other_session' },
    });

    return ok(undefined);
  }

  /** Follows a verification or email-change link. */
  async verifyEmail(input: unknown): Promise<Result<{ verified: true }>> {
    const parsed = validate(emailTokenSchema, input);
    if (!parsed.ok) return parsed;

    const consumed = await this.ports.identity.consumeEmailToken(parsed.value.token);
    if (!consumed.ok) return consumed;

    await this.ports.audit.record({
      userId: consumed.value.userId,
      kind: consumed.value.kind === 'verify_email' ? 'email_verified' : 'email_changed',
      outcome: 'success',
    });

    return ok({ verified: true });
  }

  /**
   * Sends another verification link.
   *
   * Always the same answer, whether or not the address has an account or is
   * already verified, and hard-limited per address so it cannot be used to
   * fill somebody's inbox.
   */
  async resendVerification(input: unknown): Promise<Result<{ ok: true }>> {
    const parsed = validate(emailOnlySchema, input);
    if (!parsed.ok) return parsed;

    const key = await rateLimitKey('email', parsed.value.email);
    const allowed = await this.underLimit(
      key,
      'verify_resend',
      this.limits.resendPerEmail,
      this.limits.resendWindowSeconds,
    );
    if (!allowed.ok) return allowed;

    await this.ports.rateLimit.record(key, 'verify_resend');
    await this.ports.identity.resendVerification(parsed.value.email);

    return ok({ ok: true });
  }

  /**
   * Starts a password reset. Always 200 unless rate-limited (plan §9.4).
   *
   * Limited per address and per client address: the first stops one inbox
   * being flooded, the second stops one machine walking a list of addresses.
   */
  async forgotPassword(
    input: unknown,
    context: { ip?: string } = {},
  ): Promise<Result<{ ok: true }>> {
    const parsed = validate(emailOnlySchema, input);
    if (!parsed.ok) return parsed;

    const emailKey = await rateLimitKey('email', parsed.value.email);
    const ipKey = await rateLimitKey('ip', context.ip ?? UNKNOWN_IP);

    const allowedForEmail = await this.underLimit(
      emailKey,
      'reset',
      this.limits.resetPerEmail,
      this.limits.resetWindowSeconds,
    );
    if (!allowedForEmail.ok) return allowedForEmail;

    const allowedForIp = await this.underLimit(
      ipKey,
      'reset',
      this.limits.resetPerIp,
      this.limits.resetWindowSeconds,
    );
    if (!allowedForIp.ok) return allowedForIp;

    await this.ports.rateLimit.record(emailKey, 'reset');
    await this.ports.rateLimit.record(ipKey, 'reset');
    await this.ports.auth.requestPasswordReset(parsed.value.email);

    return ok({ ok: true });
  }

  /** Sets a new password from a reset link. Every session ends. */
  async resetPassword(input: unknown): Promise<Result<{ ok: true }>> {
    const parsed = validate(passwordResetConfirmSchema, input);
    if (!parsed.ok) return parsed;

    const rejection = rejectUnusablePassword(parsed.value.newPassword);
    if (rejection) return rejection;

    const reset = await this.ports.identity.resetPassword(
      parsed.value.token,
      parsed.value.newPassword,
    );
    if (!reset.ok) return reset;

    await this.ports.audit.record({
      userId: reset.value.userId,
      kind: 'password_reset',
      outcome: 'success',
    });

    return ok({ ok: true });
  }

  /**
   * Changes the password of a signed-in user, who must know the current one.
   *
   * An unlocked laptop is not a password. Wrong guesses are counted against
   * the account, so a borrowed session cannot be used to guess it either.
   */
  async changePassword(caller: CallerIdentity, input: unknown): Promise<Result<{ ok: true }>> {
    const parsed = validate(passwordChangeSchema, input);
    if (!parsed.ok) return parsed;

    const confirmed = await this.confirmPassword(caller, parsed.value.currentPassword);
    if (!confirmed.ok) return confirmed;

    const rejection = rejectUnusablePassword(parsed.value.newPassword);
    if (rejection) return rejection;

    const changed = await this.ports.identity.changePassword(
      caller.userId,
      parsed.value.newPassword,
      parsed.value.signOutOtherDevices ? caller.sessionId : null,
    );
    if (!changed.ok) return changed;

    await this.ports.audit.record({
      userId: caller.userId,
      deviceId: caller.deviceId,
      kind: 'password_changed',
      outcome: 'success',
      detail: { signedOutOthers: parsed.value.signOutOtherDevices },
    });

    return ok({ ok: true });
  }

  /** Mails a link to the new address; the account moves when it is followed. */
  async requestEmailChange(caller: CallerIdentity, input: unknown): Promise<Result<{ ok: true }>> {
    const parsed = validate(emailChangeSchema, input);
    if (!parsed.ok) return parsed;

    const confirmed = await this.confirmPassword(caller, parsed.value.password);
    if (!confirmed.ok) return confirmed;

    const requested = await this.ports.identity.requestEmailChange(
      caller.userId,
      parsed.value.newEmail,
    );
    if (!requested.ok) return requested;

    return ok({ ok: true });
  }

  // -------------------------------------------------------------------------

  private async confirmPassword(caller: CallerIdentity, password: string): Promise<Result<void>> {
    const key = `user:${caller.userId}`;

    const allowed = await this.underLimit(
      key,
      'sign_in',
      this.limits.passwordChecksPerUser,
      this.limits.passwordCheckWindowSeconds,
    );
    if (!allowed.ok) return allowed;

    const matches = await this.ports.identity.verifyPassword(caller.userId, password);
    if (!matches.ok) return matches;

    if (!matches.value) {
      await this.ports.rateLimit.record(key, 'sign_in');
      await this.ports.audit.record({
        userId: caller.userId,
        deviceId: caller.deviceId,
        kind: 'password_changed',
        outcome: 'failure',
        detail: { reason: 'wrong_current_password' },
      });

      return err('permission_denied', 'That is not your current password.');
    }

    return ok(undefined);
  }

  /** Fails closed, like `AuthService`: an unreachable counter is an outage, not a free pass. */
  private async underLimit(
    key: string,
    kind: string,
    limit: number,
    windowSeconds: number,
  ): Promise<Result<void>> {
    const count = await this.ports.rateLimit.countRecent(key, kind, windowSeconds);

    if (!count.ok) {
      return err(
        'storage_unavailable',
        'This is unavailable right now. Try again in a few minutes.',
      );
    }

    if (count.value >= limit) {
      return err('permission_denied', 'Too many attempts. Wait a few minutes before trying again.');
    }

    return ok(undefined);
  }
}

function rejectUnusablePassword(password: string): Result<never, NotoError> | null {
  const verdict = checkPassword(password);
  if (verdict.acceptable) return null;

  const first = verdict.problems[0];
  return err('invalid_input', first ? describeProblem(first) : 'That password cannot be used.');
}
