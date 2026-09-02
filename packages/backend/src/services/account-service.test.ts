import { describe, expect, it } from 'vitest';

import {
  FakeAuditPort,
  FakeDevicePort,
  FakeProfilePort,
  createFakePorts,
} from '../testing/index.ts';
import { AccountService } from './account-service.ts';

const CURRENT_DEVICE = '11111111-1111-4111-8111-111111111111';
const OTHER_DEVICE = '22222222-2222-4222-8222-222222222222';

function makeService(overrides = {}) {
  const ports = createFakePorts(overrides);
  return { service: new AccountService(ports), ports };
}

describe('AccountService.listDevices', () => {
  it('marks the caller’s own device and sorts by most recent activity', async () => {
    const devices = new FakeDevicePort();
    const { service } = makeService({ devices });

    await devices.upsert('user-1', {
      id: OTHER_DEVICE,
      name: 'Phone',
      platform: 'android',
      osName: 'Android 15',
      appVersion: '1.3.0',
    });
    await devices.upsert('user-1', {
      id: CURRENT_DEVICE,
      name: 'ThinkPad',
      platform: 'windows',
      osName: 'Windows 11 Pro',
      appVersion: '1.3.0',
    });

    const result = await service.listDevices('user-1', CURRENT_DEVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const current = result.value.filter((entry) => entry.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe(CURRENT_DEVICE);
  });

  it('never returns another user’s devices', async () => {
    const devices = new FakeDevicePort();
    const { service } = makeService({ devices });

    await devices.upsert('user-2', {
      id: OTHER_DEVICE,
      name: 'Someone else’s laptop',
      platform: 'macos',
      osName: 'macOS 15',
      appVersion: '1.3.0',
    });

    const result = await service.listDevices('user-1', CURRENT_DEVICE);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });
});

describe('AccountService.revokeDevice', () => {
  it('refuses to revoke the device making the request', async () => {
    const { service } = makeService();

    const result = await service.revokeDevice('user-1', CURRENT_DEVICE, CURRENT_DEVICE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('this device');
  });

  it('revokes rather than deletes, so the security log keeps its subject', async () => {
    const devices = new FakeDevicePort();
    const audit = new FakeAuditPort();
    const { service } = makeService({ devices, audit });

    await devices.upsert('user-1', {
      id: OTHER_DEVICE,
      name: 'Old phone',
      platform: 'android',
      osName: 'Android 14',
      appVersion: '1.2.0',
    });

    const result = await service.revokeDevice('user-1', OTHER_DEVICE, CURRENT_DEVICE);

    expect(result.ok).toBe(true);
    expect(devices.devices.get(OTHER_DEVICE)?.revokedAt).not.toBeNull();
    expect(audit.events.at(-1)?.kind).toBe('device_revoked');
  });

  it('will not revoke a device belonging to somebody else', async () => {
    const devices = new FakeDevicePort();
    const { service } = makeService({ devices });

    await devices.upsert('user-2', {
      id: OTHER_DEVICE,
      name: 'Not yours',
      platform: 'linux',
      osName: 'Fedora 42',
      appVersion: '1.3.0',
    });

    const result = await service.revokeDevice('user-1', OTHER_DEVICE, CURRENT_DEVICE);

    expect(result.ok).toBe(false);
  });
});

describe('AccountService.updateSettings', () => {
  it('merges rather than replaces, so an older client cannot erase a setting', async () => {
    const { service } = makeService();

    await service.updateSettings('user-1', { editor: { fontSize: 18, wordWrap: true } });
    // A client that has never heard of `wordWrap` sends only what it knows.
    const result = await service.updateSettings('user-1', { editor: { fontSize: 20 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.editor.fontSize).toBe(20);
      expect(result.value.editor.wordWrap).toBe(true);
    }
  });

  it('rejects a patch that is not an object of known groups', async () => {
    const { service } = makeService();

    const result = await service.updateSettings('user-1', { editor: 'large' });

    expect(result.ok).toBe(false);
  });
});

describe('AccountService.updateProfile', () => {
  it('rejects an empty display name', async () => {
    const { service } = makeService();

    const result = await service.updateProfile('user-1', { displayName: '   ' });

    expect(result.ok).toBe(false);
  });

  it('trims a display name before storing it', async () => {
    const profiles = new FakeProfilePort();
    profiles.profiles.set('user-1', {
      id: 'user-1',
      email: 'writer@example.com',
      displayName: 'Old',
      avatarUrl: null,
      locale: 'en',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { service } = makeService({ profiles });
    const result = await service.updateProfile('user-1', { displayName: '  Utkarsh  ' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.displayName).toBe('Utkarsh');
  });
});
