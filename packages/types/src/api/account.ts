import type { IsoDateTime } from '../common.ts';
import type { DevicePlatform, SessionKind } from '../device.ts';
import type { AppearanceSettings, EditorSettings, UpdateSettings } from '../settings.ts';

/**
 * What a device says about itself when it signs in.
 *
 * The id comes from the device's own storage, which is what makes the account
 * screen a list of installations rather than a list of sessions: signing out and
 * back in reuses this row, reinstalling Noto creates a new one.
 */
export interface DeviceRegistrationDto {
  id: string;
  name: string;
  platform: DevicePlatform;
  osName: string;
  appVersion: string;
}

/** A device as the account screen shows it. */
export interface DeviceDto {
  id: string;
  name: string;
  platform: DevicePlatform;
  osName: string;
  appVersion: string;
  /** Coarse city and country, resolved server-side. Never GPS. */
  location: string | null;
  lastActiveAt: IsoDateTime;
  /** Computed by the client against its own device id; never stored. */
  isCurrent: boolean;
  revokedAt: IsoDateTime | null;
}

/** An active sign-in. Shorter-lived than the device that holds it. */
export interface SessionDto {
  id: string;
  kind: SessionKind;
  client: string;
  location: string | null;
  startedAt: IsoDateTime;
  lastActiveAt: IsoDateTime;
  isCurrent: boolean;
}

/**
 * The settings tree, as it crosses the wire.
 *
 * Partial on purpose: the server stores what it was given and the client fills
 * the gaps from `@noto/config` defaults. A Noto that is one version behind must
 * not lose a setting it does not yet know about, and must not be told to
 * invent one it has never heard of.
 */
export interface SettingsDto {
  appearance: Partial<AppearanceSettings>;
  editor: Partial<EditorSettings>;
  updates: Partial<UpdateSettings>;
  syncEnabled: boolean;
  updatedAt: IsoDateTime;
}

/** One line of the security log, as the account screen shows it. */
export interface AuthEventDto {
  id: string;
  kind: string;
  outcome: 'success' | 'failure';
  deviceName: string | null;
  location: string | null;
  createdAt: IsoDateTime;
}

/**
 * Deleting an account.
 *
 * Re-authentication is required — a borrowed unlocked laptop should not be able
 * to destroy someone's writing. `confirmEmail` must match the account's address:
 * it is the typed confirmation, not a lookup key.
 */
export interface AccountDeletionRequest {
  password?: string;
  mfaCode?: string;
  reason?: string;
  confirmEmail: string;
}
