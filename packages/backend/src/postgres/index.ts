import type {
  BackendPorts,
  CallerIdentity,
  IdentityPort,
  MailPort,
  TurnstilePort,
} from '../ports/index.ts';
import type { MailLinks } from '../shared/mail.ts';
import {
  PostgresAuditAdapter,
  PostgresDeviceAdapter,
  PostgresProfileAdapter,
  PostgresRateLimitAdapter,
  PostgresSettingsAdapter,
} from './adapters.ts';
import { type AccessTokens, type PasswordHasher, PostgresAuthAdapter } from './auth.ts';
import type { PostgresDatabase } from './database.ts';

export * from './adapters.ts';
export * from './auth.ts';
export * from './database.ts';
export * from './rows.ts';
export type * from './schema.ts';

/**
 * Every port, backed by Postgres, for one request.
 *
 * Built per request because two of the adapters are bound to who is asking:
 * the auth adapter's "sign out" and "who am I" act on `caller`, and sign-in's
 * device registration is the one privileged write a request makes. Nothing
 * here opens a connection — `db` is shared, and cheap to hand out.
 */
export function createPostgresPorts(options: {
  db: PostgresDatabase;
  hasher: PasswordHasher;
  tokens: AccessTokens;
  mail: MailPort;
  links: MailLinks;
  turnstile: TurnstilePort;
  caller?: CallerIdentity | null;
  refreshTokenTtlSeconds?: number;
}): BackendPorts & { identity: IdentityPort; signInDevices: PostgresDeviceAdapter } {
  const auth = new PostgresAuthAdapter(options);

  return {
    auth,
    identity: auth,
    profiles: new PostgresProfileAdapter(options.db),
    devices: new PostgresDeviceAdapter(options.db),
    signInDevices: new PostgresDeviceAdapter(options.db, { privileged: true }),
    settings: new PostgresSettingsAdapter(options.db),
    audit: new PostgresAuditAdapter(options.db),
    rateLimit: new PostgresRateLimitAdapter(options.db),
    turnstile: options.turnstile,
  };
}
