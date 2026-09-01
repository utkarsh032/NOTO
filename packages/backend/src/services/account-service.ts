import { err, ok } from '@noto/core';
import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  DeviceDto,
  DeviceRegistrationDto,
  SettingsDto,
  UserDto,
} from '@noto/types/api';

import { validate } from '../helpers/validation';
import type { AuditPort, DevicePort, ProfilePort, SettingsPort } from '../ports';
import { deviceRegistrationSchema, settingsPatchSchema } from '../schemas';

/**
 * The account screen's service: profile, devices, settings and the security log.
 *
 * Everything here is about a single signed-in user acting on their own account.
 * The `userId` is passed in rather than discovered, because the caller — an
 * Edge Function or a client — is the one that verified the token, and a service
 * that reads ambient identity is a service you cannot test.
 */
export class AccountService {
  constructor(
    private readonly ports: {
      profiles: ProfilePort;
      devices: DevicePort;
      settings: SettingsPort;
      audit: AuditPort;
    },
  ) {}

  getProfile(userId: string): Promise<Result<UserDto>> {
    return this.ports.profiles.get(userId);
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string | null; locale?: string },
  ): Promise<Result<UserDto>> {
    const displayName = patch.displayName?.trim();

    if (displayName !== undefined && (displayName.length === 0 || displayName.length > 80)) {
      return err('invalid_input', 'A display name is between 1 and 80 characters.');
    }

    return this.ports.profiles.update(userId, {
      ...patch,
      ...(displayName === undefined ? {} : { displayName }),
    });
  }

  /**
   * Lists devices, newest activity first, with the caller's own marked.
   *
   * `isCurrent` is computed here rather than stored, because it is a fact about
   * who is asking and not a fact about the device.
   */
  async listDevices(userId: string, currentDeviceId: string | null): Promise<Result<DeviceDto[]>> {
    const devices = await this.ports.devices.list(userId);
    if (!devices.ok) return devices;

    const marked = devices.value
      .map((device) => ({ ...device, isCurrent: device.id === currentDeviceId }))
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

    return ok(marked);
  }

  async registerDevice(userId: string, input: unknown): Promise<Result<DeviceDto>> {
    const parsed = validate(deviceRegistrationSchema, input);
    if (!parsed.ok) return parsed;

    const device: DeviceRegistrationDto = parsed.value;
    return this.ports.devices.upsert(userId, device);
  }

  /**
   * Signs a device out.
   *
   * Revoking, not deleting: the row stays so the security log can still name
   * the device an event belongs to. A device that vanished would take its own
   * history with it, which is the opposite of what a security log is for.
   */
  async revokeDevice(
    userId: string,
    deviceId: string,
    currentDeviceId: string | null,
  ): Promise<Result<void>> {
    if (deviceId === currentDeviceId) {
      return err(
        'invalid_input',
        'That is this device. Use "Sign out" instead — revoking would leave you unable to sign back in from here without a fresh sign-in.',
      );
    }

    const revoked = await this.ports.devices.revoke(userId, deviceId);
    if (!revoked.ok) return revoked;

    await this.ports.audit.record({
      userId,
      deviceId,
      kind: 'device_revoked',
      outcome: 'success',
    });

    return ok(undefined);
  }

  getSettings(userId: string): Promise<Result<SettingsDto>> {
    return this.ports.settings.get(userId);
  }

  /**
   * Updates settings.
   *
   * A partial patch, merged server-side. A client one version behind must not
   * erase a setting it has never heard of by sending back the whole object
   * without it.
   */
  async updateSettings(userId: string, patch: unknown): Promise<Result<SettingsDto>> {
    const parsed = validate(settingsPatchSchema, patch);
    if (!parsed.ok) return parsed;

    return this.ports.settings.update(userId, parsed.value as Partial<SettingsDto>);
  }

  /** The security log, most recent first. */
  listSecurityEvents(userId: string, limit = 50): Promise<Result<AuthEventDto[]>> {
    return this.ports.audit.list(userId, Math.min(Math.max(limit, 1), 200));
  }
}
