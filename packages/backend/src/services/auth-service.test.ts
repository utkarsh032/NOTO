import { describe, expect, it } from 'vitest';

import type { BackendPorts } from '../ports/index.ts';
import {
  FakeAuthPort,
  FakeTurnstilePort,
  FakeDevicePort,
  FakeRateLimitPort,
  createFakePorts,
} from '../testing/index.ts';
import { AuthService } from './auth-service.ts';

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

  it('treats a sign-up awaiting email confirmation as a success', async () => {
    /*
     * The regression this exists for: GoTrue returns a user and no session when
     * confirmation is on, and that was being reported to the person as
     * "Sign-in: unexpected failure" — while the account had in fact been
     * created, so trying again told them the address was taken.
     */
    const auth = new FakeAuthPort({ confirmationRequired: true });
    const { service } = makeService({ auth });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session).toBeNull();
      expect(result.value.confirmationRequired).toBe(true);
      expect(result.value.user.email).toBe('writer@example.com');
    }
    expect(auth.users.size).toBe(1);
  });

  it('refuses a sign-up whose bot-check token does not verify', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth, turnstile: new FakeTurnstilePort({ passes: false }) });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'a-token-cloudflare-does-not-recognise',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(false);
    // Nothing was created. A rejected bot never reaches the provider.
    expect(auth.users.size).toBe(0);
  });

  it('refuses a sign-up when the bot check is unreachable', async () => {
    // The opposite policy to the breach check, and deliberately so: an outage
    // at Cloudflare must not become an open sign-up endpoint.
    const auth = new FakeAuthPort();
    const { service } = makeService({
      auth,
      turnstile: new FakeTurnstilePort({ unavailable: true }),
    });

    const result = await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    expect(result.ok).toBe(false);
    expect(auth.users.size).toBe(0);
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

describe('AuthService.signIn — an unconfirmed account', () => {
  async function attempt(confirmationRequired: boolean) {
    const auth = new FakeAuthPort({ confirmationRequired });
    const { service } = makeService({ auth });

    await service.signUp({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      turnstileToken: 'token',
      marketingOptIn: false,
    });

    return service.signIn({
      email: 'writer@example.com',
      password: 'a-perfectly-fine-passphrase',
      device,
    });
  }

  it('says so, rather than blaming the password', async () => {
    const result = await attempt(true);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Confirm your email address');
  });

  it('still refuses to say anything about an address with no account', async () => {
    // The exception is narrow: only a correct password against a real but
    // unconfirmed account earns a specific answer. Everything else stays
    // indistinguishable, which is the point of the original design.
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    const result = await service.signIn({
      email: 'nobody@example.com',
      password: 'a-perfectly-fine-passphrase',
      device,
    });

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toBe('That email and password do not match an account.');
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
