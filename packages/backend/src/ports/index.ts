import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  AuthSessionDto,
  DeviceDto,
  DeviceRegistrationDto,
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
  }): Promise<Result<AuthSessionDto>>;

  signIn(input: { email: string; password: string }): Promise<Result<AuthSessionDto>>;

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

/** The `profiles` table. */
export interface ProfilePort {
  get(userId: string): Promise<Result<UserDto>>;
  update(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string | null; locale?: string },
  ): Promise<Result<UserDto>>;
}

/** The `devices` table. */
export interface DevicePort {
  list(userId: string): Promise<Result<DeviceDto[]>>;
  /** Insert-or-update on the client-supplied id. */
  upsert(userId: string, device: DeviceRegistrationDto): Promise<Result<DeviceDto>>;
  touch(deviceId: string): Promise<Result<void>>;
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
 * Checking a password against known breaches.
 *
 * A port rather than a direct call so that tests are deterministic and offline,
 * and so a failure to reach the service can be a policy decision — see
 * `PasswordPolicy` in `src/services/auth-service.ts`.
 */
export interface BreachCheckPort {
  /** True when the password appears in a known breach corpus. */
  isBreached(password: string): Promise<Result<boolean>>;
}

/** Everything a service needs, assembled once at the composition root. */
export interface BackendPorts {
  auth: AuthPort;
  profiles: ProfilePort;
  devices: DevicePort;
  settings: SettingsPort;
  audit: AuditPort;
  rateLimit: RateLimitPort;
  breachCheck: BreachCheckPort;
}
