import type { ColumnType, Generated } from 'kysely';

import type { DevicePlatform } from '@noto/types';

/**
 * The Kysely table types.
 *
 * One interface per table, matching `apps/api/db/migrations/` column for
 * column. The migrations are the authority; these are a description of them
 * that the compiler can check queries against. A column added to one and
 * forgotten in the other is a bug either way round, and the integration tests
 * are what catch it.
 *
 * Timestamps are read as `Date` (node-postgres parses `timestamptz`) and may be
 * written as a `Date` or an ISO string.
 */

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;
// jsonb is written as a JSON string; every jsonb column has a default.
type Json<T> = ColumnType<T, string | undefined, string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  email_verified_at: Timestamp | null;
  password_hash: string | null;
  password_changed_at: Timestamp | null;
  display_name: string;
  avatar_url: string | null;
  locale: Generated<string>;
  marketing_opt_in: Generated<boolean>;
  onboarded_at: Timestamp | null;
  locked_until: Timestamp | null;
  mfa_enabled: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Timestamp | null;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  device_id: string | null;
  refresh_token_hash: string;
  previous_token_hash: string | null;
  user_agent: string | null;
  ip: string | null;
  expires_at: Timestamp;
  rotated_at: Timestamp | null;
  revoked_at: Timestamp | null;
  revoked_reason: string | null;
  created_at: CreatedAt;
}

export type EmailTokenKind = 'verify_email' | 'reset_password' | 'change_email';

export interface EmailTokensTable {
  id: Generated<string>;
  user_id: string;
  kind: EmailTokenKind;
  token_hash: string;
  new_email: string | null;
  expires_at: Timestamp;
  consumed_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface DevicesTable {
  id: string;
  user_id: string;
  name: string;
  platform: DevicePlatform;
  os_name: string;
  app_version: string;
  push_token: string | null;
  last_seen_ip: string | null;
  location: string | null;
  last_active_at: UpdatedAt;
  revoked_at: Timestamp | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Timestamp | null;
}

export interface AuthEventsTable {
  /** `bigint`, which node-postgres returns as a string. */
  id: ColumnType<string, never, never>;
  user_id: string | null;
  device_id: string | null;
  kind: string;
  outcome: 'success' | 'failure';
  ip: string | null;
  user_agent: string | null;
  detail: Json<Record<string, unknown>>;
  created_at: CreatedAt;
}

export interface AuthAttemptsTable {
  id: ColumnType<string, never, never>;
  key: string;
  kind: string;
  attempted_at: CreatedAt;
}

export interface UserSettingsTable {
  user_id: string;
  appearance: Json<Record<string, unknown>>;
  editor: Json<Record<string, unknown>>;
  updates: Json<Record<string, unknown>>;
  sync_enabled: Generated<boolean>;
  updated_at: UpdatedAt;
}

export interface Schema {
  users: UsersTable;
  sessions: SessionsTable;
  email_tokens: EmailTokensTable;
  devices: DevicesTable;
  auth_events: AuthEventsTable;
  auth_attempts: AuthAttemptsTable;
  user_settings: UserSettingsTable;
}
