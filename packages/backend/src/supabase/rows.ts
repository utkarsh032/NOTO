import type { AuthEventDto, DeviceDto, SettingsDto, UserDto } from '@noto/types/api';
import type { DevicePlatform } from '@noto/types';

/**
 * The `snake_case` → `camelCase` boundary.
 *
 * Postgres rows come back in the database's naming and the application speaks
 * the application's. Doing that translation in one file, explicitly, is what
 * keeps the rest of the package from being written half in each — and it is
 * the same approach `packages/database/src/sqlite/rows.ts` already takes for
 * SQLite, for the same reason.
 *
 * These are the row shapes, not the table definitions. A column the application
 * never reads does not appear here.
 */

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  name: string;
  platform: DevicePlatform;
  os_name: string;
  app_version: string;
  location: string | null;
  last_active_at: string;
  revoked_at: string | null;
}

export interface SettingsRow {
  appearance: Record<string, unknown>;
  editor: Record<string, unknown>;
  updates: Record<string, unknown>;
  sync_enabled: boolean;
  updated_at: string;
}

export interface AuthEventRow {
  id: number;
  kind: string;
  outcome: string;
  created_at: string;
  devices: { name: string; location: string | null } | null;
}

/**
 * `emailVerified` and `mfaEnabled` come from GoTrue, not from `profiles`, so
 * they are passed in rather than read from the row. The table deliberately does
 * not mirror them: two copies of "is this address verified" is one copy too
 * many, and the wrong one would eventually be believed.
 */
export function toUserDto(
  row: ProfileRow,
  auth: { emailVerified: boolean; mfaEnabled: boolean },
): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    emailVerified: auth.emailVerified,
    mfaEnabled: auth.mfaEnabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    lastActiveAt: row.last_active_at,
    isCurrent: false,
    revokedAt: row.revoked_at,
  };
}

export function toSettingsDto(row: SettingsRow): SettingsDto {
  return {
    appearance: row.appearance as SettingsDto['appearance'],
    editor: row.editor as SettingsDto['editor'],
    updates: row.updates as SettingsDto['updates'],
    syncEnabled: row.sync_enabled,
    updatedAt: row.updated_at,
  };
}

export function toAuthEventDto(row: AuthEventRow): AuthEventDto {
  return {
    id: String(row.id),
    kind: row.kind,
    outcome: row.outcome === 'success' ? 'success' : 'failure',
    deviceName: row.devices?.name ?? null,
    location: row.devices?.location ?? null,
    createdAt: row.created_at,
  };
}
