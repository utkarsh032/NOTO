import {
  AccountService,
  AuthService,
  type AuthServiceOptions,
  type CallerIdentity,
  IdentityService,
  type IdentityRateLimits,
  type MailPort,
  type TurnstilePort,
} from '@noto/backend';
import {
  type AccessTokens,
  type PasswordHasher,
  type PostgresDatabase,
  createPostgresPorts,
} from '@noto/backend/postgres';
import type { MailLinks } from '@noto/backend/shared';

/**
 * Everything a request needs, built per request.
 *
 * The services are the same classes the Edge Functions used — `AuthService`
 * and `AccountService` do not know this is Postgres. Building them per request
 * is cheap (no connections are opened) and is what lets the auth adapter act
 * on "the caller" without ever reading it from the request itself.
 */

export interface ApiDependencies {
  db: PostgresDatabase;
  hasher: PasswordHasher;
  tokens: AccessTokens;
  mail: MailPort;
  links: MailLinks;
  turnstile: TurnstilePort;
  refreshTokenTtlSeconds: number;
  /** Tests set `minimumAttemptMs: 0`; production keeps the padding. */
  authOptions?: AuthServiceOptions;
  identityRateLimits?: IdentityRateLimits;
  /** `select 1` against the database. */
  ready(): Promise<boolean>;
}

export interface RequestServices {
  auth: AuthService;
  account: AccountService;
  identity: IdentityService;
}

export function servicesFor(deps: ApiDependencies, caller: CallerIdentity | null): RequestServices {
  const ports = createPostgresPorts({ ...deps, caller });

  return {
    // Sign-in registers the device with the privileged adapter: a fresh,
    // password-checked sign-in is the one thing allowed to un-revoke a device.
    auth: new AuthService({ ...ports, devices: ports.signInDevices }, deps.authOptions),
    account: new AccountService(ports),
    identity: new IdentityService(
      ports,
      deps.identityRateLimits === undefined ? {} : { rateLimits: deps.identityRateLimits },
    ),
  };
}
