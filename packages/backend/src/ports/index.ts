import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  AuthSessionDto,
  AuthSignUpDto,
  DeviceDto,
  DeviceRegistrationDto,
  SessionDto,
  SettingsDto,
  UserDto,
} from '@noto/types/api';

/**
 * The ports.
 *
 * Every one of these is an interface the services depend on and the adapters in
 * `src/supabase/` implement. That indirection buys three specific things, and it
 * would not be worth having for fewer:
 *
 * 1. The services are unit-testable with no network, no Docker and no Supabase
 *    project — see `src/testing/`. A test for "six failures locks the account"
 *    should not need a database.
 * 2. Swapping the vendor is a directory, not a rewrite. `R&D/Backend_Plan.md`
 *    §1.3 lists the alternatives; this is what makes that claim true rather
 *    than aspirational.
 * 3. The same service runs in an Edge Function and in the client, because
 *    neither is named here.
 *
 * Every method returns `Result` rather than throwing, matching `@noto/core`.
 * A failed sign-in is an outcome, not an exception.
 */

// ---------------------------------------------------------------------------

/** Identity: what GoTrue does. */
export interface AuthPort {
  signUp(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
    marketingOptIn?: boolean;
  }): Promise<Result<AuthSignUpDto>>;

  signIn(input: {
    email: string;
    password: string;
    /** The installation signing in. A server-side adapter binds the session to it. */
    deviceId?: string;
    /** Where the request came from, recorded on the session. Never used to decide anything. */
    client?: ClientInfo;
  }): Promise<Result<AuthSessionDto>>;

  signOut(): Promise<Result<void>>;

  refresh(refreshToken: string): Promise<Result<AuthSessionDto>>;

  /** Returns the signed-in user, or `null` when there is no session. */
  currentUser(): Promise<Result<UserDto | null>>;

  requestPasswordReset(email: string): Promise<Result<void>>;

  updatePassword(input: {
    newPassword: string;
    signOutOtherDevices: boolean;
  }): Promise<Result<void>>;

  /** Begins a PKCE flow and returns the URL to open in the system browser. */
  startOAuth(input: {
    provider: string;
    redirectTo: string;
    codeChallenge: string;
  }): Promise<Result<{ url: string }>>;
}

/** The `profiles` table, or `users` on the Postgres backend. */
export interface ProfilePort {
  get(userId: string): Promise<Result<UserDto>>;
  update(userId: string, patch: ProfilePatch): Promise<Result<UserDto>>;
}

export interface ProfilePatch {
  displayName?: string;
  avatarUrl?: string | null;
  locale?: string;
  marketingOptIn?: boolean;
}

/** The `devices` table. */
export interface DevicePort {
  list(userId: string): Promise<Result<DeviceDto[]>>;
  /**
   * Insert-or-update on the client-supplied id, scoped to its owner.
   *
   * Updates only a row that already belongs to `userId`. An id that belongs to
   * a different user is refused with `conflict` and never reassigned.
   */
  upsert(userId: string, device: DeviceRegistrationDto): Promise<Result<DeviceDto>>;
  touch(deviceId: string): Promise<Result<void>>;
  /** Signs a device out. Where sessions are server-side, the device's sessions end with it. */
  revoke(userId: string, deviceId: string): Promise<Result<void>>;
}

/** The `user_settings` table. */
export interface SettingsPort {
  get(userId: string): Promise<Result<SettingsDto>>;
  update(userId: string, patch: Partial<SettingsDto>): Promise<Result<SettingsDto>>;
}

/** The `auth_events` table. Writes go through the service role only. */
export interface AuditPort {
  list(userId: string, limit: number): Promise<Result<AuthEventDto[]>>;
  record(event: {
    userId: string | null;
    deviceId?: string | null;
    kind: string;
    outcome: 'success' | 'failure';
    detail?: Record<string, unknown>;
  }): Promise<Result<void>>;
}

/**
 * The `auth_attempts` counters.
 *
 * Separate from `AuditPort` because the two have opposite lifetimes and
 * opposite audiences: events are kept for six months and shown to the user,
 * attempts are kept for an hour and shown to nobody.
 */
export interface RateLimitPort {
  /** How many attempts of this kind for this subject inside the window. */
  countRecent(key: string, kind: string, withinSeconds: number): Promise<Result<number>>;
  record(key: string, kind: string): Promise<Result<void>>;
}

/**
 * The bot check.
 *
 * A port rather than a `fetch` inside the service, for the same reason as every
 * other one here: the rule "a sign-up without a valid token does not happen" is
 * testable without a network, and swapping Cloudflare for something else is a
 * change to one adapter.
 */
export interface TurnstilePort {
  /**
   * Verifies a token with the issuer.
   *
   * Unlike the breach check, this one must fail closed: an unverifiable token
   * is a rejected sign-up. A bot check that waves everyone through when the
   * verifier is unreachable is exactly the moment an attacker waits for.
   */
  verify(token: string, remoteIp?: string): Promise<Result<boolean>>;
}

/** The request's origin, as the edge reported it. */
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

/** Who an access token belongs to, once it has been checked. */
export interface CallerIdentity {
  userId: string;
  sessionId: string;
  /** The installation the session was opened on, when the client said. */
  deviceId: string | null;
}

/**
 * Identity flows a server owns and a hosted provider used to.
 *
 * GoTrue did all of this out of sight. A server that owns identity has to say
 * it out loud: checking an access token against a live session, the
 * single-use tokens sent by mail, and ending sessions one at a time or all at
 * once. Only the Postgres adapter implements it; no client ever holds one.
 */
export interface IdentityPort {
  /**
   * Checks an access token and that its session is still live.
   *
   * `null` for anything that is not a usable session — expired, revoked,
   * forged or malformed. The caller answers 401 without saying which.
   */
  authenticate(accessToken: string): Promise<Result<CallerIdentity | null>>;

  /** The user's live sessions, newest activity first. `isCurrent` is left false. */
  listSessions(userId: string): Promise<Result<SessionDto[]>>;

  /** Ends one of the user's sessions. `not_found` when it is not theirs. */
  signOutSession(userId: string, sessionId: string): Promise<Result<void>>;

  /** Ends every session the user has, on every device. */
  signOutAll(userId: string): Promise<Result<void>>;

  /** Whether `password` is the user's current password. */
  verifyPassword(userId: string, password: string): Promise<Result<boolean>>;

  /**
   * Consumes a mailed token and applies it: marks the address verified, or
   * moves the account to the new address.
   *
   * `not_found` for a token that is unknown, used or expired — one answer for
   * all three, since the difference helps nobody but a guesser.
   */
  consumeEmailToken(
    token: string,
  ): Promise<Result<{ userId: string; kind: 'verify_email' | 'change_email' }>>;

  /** Mails a fresh verification link if the address has an unverified account. */
  resendVerification(email: string): Promise<Result<void>>;

  /** Sets a new password from a reset token, and ends every session. */
  resetPassword(token: string, newPassword: string): Promise<Result<{ userId: string }>>;

  /**
   * Sets a new password for a signed-in user.
   *
   * With `keepSessionId`, every other session ends and that one survives; with
   * `null`, no session is touched.
   */
  changePassword(
    userId: string,
    newPassword: string,
    keepSessionId: string | null,
  ): Promise<Result<void>>;

  /** Mails a confirmation link to the new address. The account moves only when it is followed. */
  requestEmailChange(userId: string, newEmail: string): Promise<Result<void>>;
}

/** Transactional mail: verification, reset, and the notices that go with them. */
export interface MailPort {
  send(message: { to: string; subject: string; text: string; html: string }): Promise<Result<void>>;
}

/** Everything a service needs, assembled once at the composition root. */
export interface BackendPorts {
  auth: AuthPort;
  profiles: ProfilePort;
  devices: DevicePort;
  settings: SettingsPort;
  audit: AuditPort;
  rateLimit: RateLimitPort;
  turnstile: TurnstilePort;
}
