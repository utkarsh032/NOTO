import { err, ok } from '@noto/core';
import type { Result } from '@noto/types';
import type {
  AuthEventDto,
  AuthSessionDto,
  DeviceDto,
  DeviceRegistrationDto,
  SettingsDto,
  UserDto,
} from '@noto/types/api';

import type {
  AuditPort,
  AuthPort,
  BackendPorts,
  TurnstilePort,
  DevicePort,
  ProfilePort,
  RateLimitPort,
  SettingsPort,
} from '../ports/index.ts';

/**
 * In-memory ports.
 *
 * These exist so the services can be tested for what they actually do —
 * ordering, policy, what happens when a dependency fails — without Docker, a
 * Supabase project or a network. A test that needs a database to prove that six
 * failures lock an account is testing the database.
 *
 * They are exported under `@noto/backend/testing` so an application can use
 * them for a demo mode or a screenshot fixture, not only the test suite.
 */

export class FakeAuthPort implements AuthPort {
  readonly users = new Map<string, { password: string; user: UserDto }>();
  signOutOthersCalled = false;
  resetRequests: string[] = [];

  constructor(private readonly options: { failWith?: string } = {}) {}

  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<Result<AuthSessionDto>> {
    if (this.options.failWith) return err('unknown', this.options.failWith);
    if (this.users.has(input.email)) return err('conflict', 'That account already exists.');

    const user: UserDto = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      displayName: input.displayName ?? input.email.split('@')[0] ?? '',
      avatarUrl: null,
      locale: 'en',
      emailVerified: false,
      mfaEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    this.users.set(input.email, { password: input.password, user });
    return ok(this.sessionFor(user));
  }

  async signIn(input: { email: string; password: string }): Promise<Result<AuthSessionDto>> {
    const record = this.users.get(input.email);

    if (!record || record.password !== input.password) {
      return err('permission_denied', 'Invalid credentials.');
    }

    return ok(this.sessionFor(record.user));
  }

  async signOut(): Promise<Result<void>> {
    return ok(undefined);
  }

  async refresh(): Promise<Result<AuthSessionDto>> {
    return err('permission_denied', 'Not implemented in the fake.');
  }

  async currentUser(): Promise<Result<UserDto | null>> {
    return ok(null);
  }

  async requestPasswordReset(email: string): Promise<Result<void>> {
    this.resetRequests.push(email);
    return ok(undefined);
  }

  async updatePassword(input: {
    newPassword: string;
    signOutOtherDevices: boolean;
  }): Promise<Result<void>> {
    if (input.signOutOtherDevices) this.signOutOthersCalled = true;
    return ok(undefined);
  }

  async startOAuth(): Promise<Result<{ url: string }>> {
    return ok({ url: 'https://example.test/oauth' });
  }

  private sessionFor(user: UserDto): AuthSessionDto {
    return {
      accessToken: `access-${user.id}`,
      refreshToken: `refresh-${user.id}`,
      expiresAt: '2026-01-01T01:00:00.000Z',
      user,
      mfaRequired: false,
    };
  }
}

export class FakeDevicePort implements DevicePort {
  readonly devices = new Map<string, DeviceDto & { userId: string }>();

  constructor(private readonly options: { failUpsert?: boolean } = {}) {}

  async list(userId: string): Promise<Result<DeviceDto[]>> {
    return ok([...this.devices.values()].filter((device) => device.userId === userId));
  }

  async upsert(userId: string, device: DeviceRegistrationDto): Promise<Result<DeviceDto>> {
    if (this.options.failUpsert) return err('storage_unavailable', 'No connection.');

    const stored = {
      ...device,
      userId,
      location: null,
      lastActiveAt: '2026-01-01T00:00:00.000Z',
      isCurrent: false,
      revokedAt: null,
    };

    this.devices.set(device.id, stored);
    return ok(stored);
  }

  async touch(): Promise<Result<void>> {
    return ok(undefined);
  }

  async revoke(userId: string, deviceId: string): Promise<Result<void>> {
    const device = this.devices.get(deviceId);
    if (!device || device.userId !== userId) return err('not_found', 'No such device.');

    this.devices.set(deviceId, { ...device, revokedAt: '2026-01-02T00:00:00.000Z' });
    return ok(undefined);
  }
}

export class FakeProfilePort implements ProfilePort {
  readonly profiles = new Map<string, UserDto>();

  async get(userId: string): Promise<Result<UserDto>> {
    const profile = this.profiles.get(userId);
    if (!profile) return err('not_found', 'No such profile.');

    return ok(profile);
  }

  async update(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string | null; locale?: string },
  ): Promise<Result<UserDto>> {
    const profile = this.profiles.get(userId);
    if (!profile) return err('not_found', 'No such profile.');

    const updated: UserDto = {
      ...profile,
      ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
      ...(patch.avatarUrl === undefined ? {} : { avatarUrl: patch.avatarUrl }),
      ...(patch.locale === undefined ? {} : { locale: patch.locale }),
    };

    this.profiles.set(userId, updated);
    return ok(updated);
  }
}

export class FakeSettingsPort implements SettingsPort {
  readonly settings = new Map<string, SettingsDto>();

  async get(userId: string): Promise<Result<SettingsDto>> {
    return ok(
      this.settings.get(userId) ?? {
        appearance: {},
        editor: {},
        updates: {},
        syncEnabled: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    );
  }

  async update(userId: string, patch: Partial<SettingsDto>): Promise<Result<SettingsDto>> {
    const current = await this.get(userId);
    if (!current.ok) return current;

    const merged: SettingsDto = {
      appearance: { ...current.value.appearance, ...patch.appearance },
      editor: { ...current.value.editor, ...patch.editor },
      updates: { ...current.value.updates, ...patch.updates },
      syncEnabled: patch.syncEnabled ?? current.value.syncEnabled,
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    this.settings.set(userId, merged);
    return ok(merged);
  }
}

export class FakeAuditPort implements AuditPort {
  readonly events: {
    userId: string | null;
    kind: string;
    outcome: string;
    detail?: Record<string, unknown>;
  }[] = [];

  async list(): Promise<Result<AuthEventDto[]>> {
    return ok([]);
  }

  async record(event: {
    userId: string | null;
    kind: string;
    outcome: 'success' | 'failure';
    detail?: Record<string, unknown>;
  }): Promise<Result<void>> {
    this.events.push(event);
    return ok(undefined);
  }
}

export class FakeRateLimitPort implements RateLimitPort {
  readonly attempts: { key: string; kind: string }[] = [];

  constructor(private readonly options: { unavailable?: boolean } = {}) {}

  async countRecent(key: string, kind: string): Promise<Result<number>> {
    if (this.options.unavailable) return err('storage_unavailable', 'Counter unreachable.');

    return ok(
      this.attempts.filter((attempt) => attempt.key === key && attempt.kind === kind).length,
    );
  }

  async record(key: string, kind: string): Promise<Result<void>> {
    this.attempts.push({ key, kind });
    return ok(undefined);
  }
}

export class FakeTurnstilePort implements TurnstilePort {
  constructor(private readonly options: { passes?: boolean; unavailable?: boolean } = {}) {}

  verify(): Promise<Result<boolean>> {
    if (this.options.unavailable) {
      return Promise.resolve(err('storage_unavailable', 'The bot check could not be reached.'));
    }

    return Promise.resolve(ok(this.options.passes ?? true));
  }
}

/** Every port, faked. Override any of them for the case under test. */
export function createFakePorts(overrides: Partial<BackendPorts> = {}): BackendPorts {
  return {
    auth: new FakeAuthPort(),
    profiles: new FakeProfilePort(),
    devices: new FakeDevicePort(),
    settings: new FakeSettingsPort(),
    audit: new FakeAuditPort(),
    rateLimit: new FakeRateLimitPort(),
    turnstile: new FakeTurnstilePort(),
    ...overrides,
  };
}
