import type { DevicePlatform, SessionKind } from '@noto/types';
import type { AuthEventDto, DeviceDto, SessionDto, SettingsDto, UserDto } from '@noto/types/api';

/**
 * The `snake_case` → `camelCase` boundary, for Postgres.
 *
 * The same job `src/supabase/rows.ts` does, against the tables in
 * `apps/api/db/migrations/`. node-postgres hands back `timestamptz` as a
 * `Date`, so the conversion to the wire's ISO strings happens here too.
 *
 * The column lists are exported because they are also the `select` lists.
 * `noto_api` is not granted `users.password_hash`, so a `select *` would fail
 * outright — which is the intended backstop, not the plan. The plan is that no
 * query ever asks for it.
 */

export const USER_COLUMNS = [
  'id',
  'email',
  'email_verified_at',
  'password_changed_at',
  'display_name',
  'avatar_url',
  'locale',
  'mfa_enabled',
  'created_at',
  'updated_at',
] as const;

export interface UserRow {
  id: string;
  email: string;
  email_verified_at: Date | null;
  password_changed_at: Date | null;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  mfa_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export const DEVICE_COLUMNS = [
  'id',
  'name',
  'platform',
  'os_name',
  'app_version',
  'location',
  'last_active_at',
  'revoked_at',
] as const;

export interface DeviceRow {
  id: string;
  name: string;
  platform: DevicePlatform;
  os_name: string;
  app_version: string;
  location: string | null;
  last_active_at: Date;
  revoked_at: Date | null;
}

export interface SettingsRow {
  appearance: Record<string, unknown>;
  editor: Record<string, unknown>;
  updates: Record<string, unknown>;
  sync_enabled: boolean;
  updated_at: Date;
}

export interface AuthEventRow {
  id: string;
  kind: string;
  outcome: string;
  created_at: Date;
  device_name: string | null;
  device_location: string | null;
}

export interface SessionRow {
  id: string;
  user_agent: string | null;
  created_at: Date;
  rotated_at: Date | null;
  device_name: string | null;
  device_platform: DevicePlatform | null;
  device_app_version: string | null;
  device_location: string | null;
}

export function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    emailVerified: row.email_verified_at !== null,
    mfaEnabled: row.mfa_enabled,
    passwordChangedAt: isoOrNull(row.password_changed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** `isCurrent` is decided by the caller, which is the only party that knows. */
export function toDeviceDto(row: DeviceRow): DeviceDto {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    osName: row.os_name,
    appVersion: row.app_version,
    location: row.location,
    lastActiveAt: iso(row.last_active_at),
    isCurrent: false,
    revokedAt: isoOrNull(row.revoked_at),
  };
}

export function toSettingsDto(row: SettingsRow): SettingsDto {
  return {
    appearance: row.appearance as SettingsDto['appearance'],
    editor: row.editor as SettingsDto['editor'],
    updates: row.updates as SettingsDto['updates'],
    syncEnabled: row.sync_enabled,
    updatedAt: iso(row.updated_at),
  };
}

export function toAuthEventDto(row: AuthEventRow): AuthEventDto {
  return {
    id: String(row.id),
    kind: row.kind,
    outcome: row.outcome === 'success' ? 'success' : 'failure',
    deviceName: row.device_name,
    location: row.device_location,
    createdAt: iso(row.created_at),
  };
}

function sessionKind(platform: DevicePlatform | null): SessionKind {
  switch (platform) {
    case 'windows':
    case 'macos':
    case 'linux':
      return 'desktop';
    case 'ios':
    case 'android':
      return 'mobile';
    default:
      return 'web';
  }
}

/**
 * A session as the account screen lists it.
 *
 * The device says more than the user agent ever could ("Utkarsh's laptop ·
 * Noto 1.5.0" rather than a browser string), so it wins when there is one.
 */
export function toSessionDto(row: SessionRow): SessionDto {
  const client =
    row.device_name !== null
      ? `${row.device_name}${row.device_app_version ? ` · Noto ${row.device_app_version}` : ''}`
      : (row.user_agent?.slice(0, 120) ?? 'Unknown client');

  return {
    id: row.id,
    kind: sessionKind(row.device_platform),
    client,
    location: row.device_location,
    startedAt: iso(row.created_at),
    lastActiveAt: iso(row.rotated_at ?? row.created_at),
    isCurrent: false,
  };
}
