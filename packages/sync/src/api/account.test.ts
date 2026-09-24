import { describe, expect, it, vi } from 'vitest';

import * as account from './account';
import type { ApiClient, ApiResponse } from './client';

type Reply = ApiResponse<unknown>;

function fakeClient(reply: (method: string, path: string, body: unknown) => Reply) {
  const calls: { method: string; path: string; body: unknown; auth: boolean }[] = [];
  const client: ApiClient = {
    request: vi.fn(
      (method: string, path: string, options: { body?: unknown; auth?: boolean } = {}) => {
        calls.push({ method, path, body: options.body, auth: options.auth ?? true });
        return Promise.resolve(reply(method, path, options.body)) as never;
      },
    ),
    startSession: vi.fn(() => Promise.resolve()),
    endSession: vi.fn(() => Promise.resolve()),
    hasSession: vi.fn(() => Promise.resolve(true)),
    onSessionChange: vi.fn(() => () => {}),
  };

  return { client, calls };
}

const ok = (data: unknown, status = 200): Reply => ({ ok: true, status, data });
const fail = (status: number, message?: string, fields?: Record<string, string>): Reply => ({
  ok: false,
  status,
  error: message
    ? { code: 'invalid_input', message, requestId: 'r', ...(fields ? { fields } : {}) }
    : null,
});

const device = {
  id: 'dev-1',
  name: 'Chrome',
  platform: 'web' as const,
  osName: 'Windows',
  appVersion: '1.4.1',
};

const userDto = {
  id: 'u1',
  email: 'a@b.c',
  displayName: 'A',
  avatarUrl: null,
  locale: 'en',
  emailVerified: true,
  mfaEnabled: false,
  passwordChangedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('signIn', () => {
  it('sends the device and keeps the session', async () => {
    const { client, calls } = fakeClient(() =>
      ok({
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: '2026-09-23T12:15:00Z',
        user: userDto,
        mfaRequired: false,
      }),
    );

    const outcome = await account.signIn(client, 'a@b.c', 'pw', device);

    expect(outcome).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/auth/signin',
      body: { email: 'a@b.c', password: 'pw', device },
      auth: false,
    });
    expect(client.startSession).toHaveBeenCalledWith({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2026-09-23T12:15:00Z',
    });
  });

  it('passes the server message and field errors through', async () => {
    const { client } = fakeClient(() => fail(400, 'Check the form.', { email: 'Invalid' }));

    expect(await account.signIn(client, 'x', 'pw', device)).toEqual({
      ok: false,
      message: 'Check the form.',
      fields: { email: 'Invalid' },
    });
    expect(client.startSession).not.toHaveBeenCalled();
  });

  it('flags an unconfirmed address', async () => {
    const { client } = fakeClient(() => ({
      ok: false,
      status: 403,
      error: { code: 'email_unverified' as never, message: 'Confirm your email.', requestId: 'r' },
    }));

    const outcome = await account.signIn(client, 'a@b.c', 'pw', device);

    expect(outcome).toMatchObject({ ok: false, unconfirmed: true });
  });

  it('says the server was unreachable when nothing arrived', async () => {
    const { client } = fakeClient(() => ({ ok: false, status: 0, error: null }));

    const outcome = await account.signIn(client, 'x', 'pw', device);

    expect(outcome.message).toMatch(/reach the server/);
  });

  it('refuses a session that still needs a second factor', async () => {
    const { client } = fakeClient(() =>
      ok({ accessToken: 'a', refreshToken: 'r', expiresAt: 'x', user: userDto, mfaRequired: true }),
    );

    const outcome = await account.signIn(client, 'a@b.c', 'pw', device);

    expect(outcome.ok).toBe(false);
    expect(client.startSession).not.toHaveBeenCalled();
  });
});

describe('signUp', () => {
  it('reports that the address must be confirmed', async () => {
    const { client, calls } = fakeClient(() =>
      ok({ user: userDto, session: null, confirmationRequired: true }),
    );

    const outcome = await account.signUp(client, {
      email: 'a@b.c',
      password: 'pw',
      displayName: 'A',
      turnstileToken: 't',
    });

    expect(outcome).toEqual({ ok: true, confirmationRequired: true });
    expect(calls[0]?.auth).toBe(false);
    expect(client.startSession).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('forgets the session even when the server could not be told', async () => {
    const { client } = fakeClient(() => ({ ok: false, status: 0, error: null }));

    expect(await account.signOut(client)).toEqual({ revoked: false });
    expect(client.endSession).toHaveBeenCalled();
  });

  it('reports a revoked session', async () => {
    const { client } = fakeClient(() => ok(null, 204));

    expect(await account.signOut(client)).toEqual({ revoked: true });
  });
});

describe('fetchProfile', () => {
  it('maps the user and the security facts', async () => {
    const { client } = fakeClient(() => ok(userDto));

    const profile = await account.fetchProfile(client);

    expect(profile?.user).toMatchObject({ id: 'u1', email: 'a@b.c', deletedAt: null });
    expect(profile?.security).toEqual({
      passwordChangedAt: '2026-09-01T00:00:00Z',
      twoFactorEnabled: false,
      emailVerified: true,
    });
  });

  it('is null when nobody is signed in', async () => {
    const { client } = fakeClient(() => fail(401));

    expect(await account.fetchProfile(client)).toBeNull();
  });

  it('rejects when the server could not be asked, which is not a sign-out', async () => {
    const { client } = fakeClient(() => ({ ok: false, status: 0, error: null }));

    await expect(account.fetchProfile(client)).rejects.toThrow();
  });
});

describe('devices, sessions and events', () => {
  it('lists live devices and marks this one', async () => {
    const base = {
      name: 'n',
      platform: 'web',
      osName: 'o',
      appVersion: '1',
      location: null,
      lastActiveAt: '2026-09-23T00:00:00Z',
      isCurrent: false,
    };
    const { client } = fakeClient(() =>
      ok([
        { ...base, id: 'dev-1', revokedAt: null },
        { ...base, id: 'dev-2', revokedAt: null },
        { ...base, id: 'dev-3', revokedAt: '2026-09-01T00:00:00Z' },
      ]),
    );

    const devices = await account.fetchDevices(client, 'dev-2');

    expect(devices.map((d) => [d.id, d.isCurrent])).toEqual([
      ['dev-1', false],
      ['dev-2', true],
    ]);
  });

  it('revokes a device by an encoded id', async () => {
    const { client, calls } = fakeClient(() => ok(null, 204));

    expect(await account.revokeDevice(client, 'a/b')).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/account/devices/a%2Fb' });
  });

  it('treats a missing sessions route as not offered', async () => {
    const { client } = fakeClient(() => fail(404, 'Not found'));

    expect(await account.fetchSessions(client)).toBeNull();
  });

  it('reads events as a bare array or a page', async () => {
    const event = {
      id: 'e1',
      kind: 'sign_in',
      outcome: 'success',
      deviceName: null,
      location: null,
      createdAt: '2026-09-23T00:00:00Z',
    };

    expect(await account.fetchEvents(fakeClient(() => ok([event])).client)).toEqual([event]);
    expect(
      await account.fetchEvents(fakeClient(() => ok({ items: [event], nextCursor: null })).client),
    ).toEqual([event]);
  });
});
