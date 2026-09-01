import { describe, expect, it } from 'vitest';

import type { BackendPorts } from '../ports';
import {
  FakeAuthPort,
  FakeBreachCheckPort,
  FakeDevicePort,
  FakeRateLimitPort,
  createFakePorts,
} from '../testing';
import { AuthService } from './auth-service';

/**
 * These tests are about policy, not plumbing: the order of operations, what
 * happens when a dependency fails, and whether the failure paths tell an
 * attacker anything. None of them needs a database, which is the point of the
 * ports.
 *
 * `minimumAttemptMs: 0` throughout — the timing floor is real behaviour, but
 * making the suite wait a quarter of a second per sign-in would buy nothing.
 */
function makeService(overrides: Partial<BackendPorts> = {}, minimumAttemptMs = 0) {
  const ports = createFakePorts(overrides);
  const service = new AuthService(ports, { minimumAttemptMs });

  return { service, ports };
}

const device = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test ThinkPad',
  platform: 'windows' as const,
  osName: 'Windows 11 Pro',
  appVersion: '1.3.0',
};

describe('AuthService.signUp', () => {
  it('creates an account when everything is acceptable', async () => {
    const { service } = makeService();

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(true);
  });

  it('refuses a password that is too short before touching the provider', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'short',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(false);
    expect(auth.users.size).toBe(0);
  });

  it('refuses a password found in a breach corpus', async () => {
    const { service } = makeService({ breachCheck: new FakeBreachCheckPort({ breached: true }) });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'correct-horse-battery-staple',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('data breach');
  });

  it('allows sign-up when the breach service is unreachable', async () => {
    // The default policy fails open: a third party's outage is not ours, and
    // every local password rule still applied.
    const { service } = makeService({
      breachCheck: new FakeBreachCheckPort({ unavailable: true }),
    });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects a request that is missing its bot-check token', async () => {
    const { service } = makeService();

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_input');
  });
});

describe('AuthService.signIn', () => {
  it('signs in and registers the device', async () => {
    const auth = new FakeAuthPort();
    const devices = new FakeDevicePort();
    const { service } = makeService({ auth, devices });

    await auth.signUp({ email: 'writer@example.com', password: 'a-perfectly-fine-passphrase' });

    const result = await service.signIn({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      device,
    });

    expect(result.ok).toBe(true);
    expect(devices.devices.get(device.id)?.name).toBe('Test ThinkPad');
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    await auth.signUp({ email: 'writer@example.com', password: 'a-perfectly-fine-passphrase' });

    const wrongPassword = await service.signIn({
      email: 'writer@example.com',
      password: 'not-the-right-password',
      device,
    });
    const unknownAddress = await service.signIn({
      email: 'nobody@example.com',
      password: 'not-the-right-password',
      device,
    });

    expect(wrongPassword.ok).toBe(false);
    expect(unknownAddress.ok).toBe(false);
    if (!wrongPassword.ok && !unknownAddress.ok) {
      expect(wrongPassword.error.code).toBe(unknownAddress.error.code);
      expect(wrongPassword.error.message).toBe(unknownAddress.error.message);
    }
  });

  it('refuses further attempts once the limit is reached', async () => {
    const rateLimit = new FakeRateLimitPort();
    const { service } = makeService({ rateLimit });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await service.signIn({ email: 'writer@example.com', password: 'wrong', device });
    }

    const result = await service.signIn({
      email: 'writer@example.com',
      password: 'wrong',
      device,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Too many attempts');
  });

  it('does not count a successful sign-in against the limit', async () => {
    const auth = new FakeAuthPort();
    const rateLimit = new FakeRateLimitPort();
    const { service } = makeService({ auth, rateLimit });

    await auth.signUp({ email: 'writer@example.com', password: 'a-perfectly-fine-passphrase' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.signIn({
        email: 'writer@example.com',
        password: 'a-perfectly-fine-passphrase',
        device,
      });
    }

    expect(rateLimit.attempts).toHaveLength(0);
  });

  it('still signs in when the rate limiter itself is unreachable', async () => {
    // Failing open is deliberate: an unreachable counter must not lock every
    // user out of their own notes. The provider has its own limits behind ours.
    const auth = new FakeAuthPort();
    const { service } = makeService({
      auth,
      rateLimit: new FakeRateLimitPort({ unavailable: true }),
    });

    await auth.signUp({ email: 'writer@example.com', password: 'a-perfectly-fine-passphrase' });

    const result = await service.signIn({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      device,
    });

    expect(result.ok).toBe(true);
  });

  it('still signs in when device registration fails', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth, devices: new FakeDevicePort({ failUpsert: true }) });

    await auth.signUp({ email: 'writer@example.com', password: 'a-perfectly-fine-passphrase' });

    const result = await service.signIn({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      device,
    });

    expect(result.ok).toBe(true);
  });

  it('records the failure in the security log without naming an account', async () => {
    const { service, ports } = makeService();

    await service.signIn({ email: 'nobody@example.com', password: 'wrong', device });

    const audit = ports.audit as unknown as { events: { userId: string | null }[] };
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.userId).toBeNull();
  });

  it('rejects a malformed device before authenticating', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    const result = await service.signIn({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      device: { ...device, id: 'not-a-uuid' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_input');
  });

  it('takes at least the timing floor, so duration reveals nothing', async () => {
    const { service } = makeService({}, 60);

    const startedAt = Date.now();
    await service.signIn({ email: 'nobody@example.com', password: 'wrong', device });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(55);
  });
});

describe('AuthService.requestPasswordReset', () => {
  it('reports success for an address with no account', async () => {
    const { service } = makeService();

    const result = await service.requestPasswordReset('nobody@example.com');

    expect(result.ok).toBe(true);
  });

  it('stops after three requests inside the window', async () => {
    const { service } = makeService();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.requestPasswordReset('writer@example.com');
    }

    const result = await service.requestPasswordReset('writer@example.com');

    expect(result.ok).toBe(false);
  });
});

describe('AuthService.updatePassword', () => {
  it('signs other devices out when asked', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    const result = await service.updatePassword({
      newPassword: 'another-perfectly-fine-passphrase',
      signOutOtherDevices: true,
    });

    expect(result.ok).toBe(true);
    expect(auth.signOutOthersCalled).toBe(true);
  });

  it('applies the same rules as sign-up', async () => {
    const { service } = makeService();

    const result = await service.updatePassword({
      newPassword: 'short',
      signOutOtherDevices: false,
    });

    expect(result.ok).toBe(false);
  });
});
