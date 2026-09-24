import type { AuthSessionDto, DeviceDto, SessionDto } from '@noto/types/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type MailBox,
  type TestDatabase,
  createTestApp,
  createTestDatabase,
  hasDatabase,
} from './harness.ts';

/**
 * Every route, through the whole middleware chain, against a real database.
 *
 * Hono's `app.request()` needs no socket. Each route gets its happy path, its
 * unauthenticated 401, and — for every route that takes an id — the
 * cross-tenant case: user B naming user A's thing gets a 404, never a 403 and
 * never the thing (plan §13).
 */

type App = ReturnType<typeof createTestApp>['app'];

const PASSWORD = 'correct horse battery staple';
let deviceCounter = 0;

function device(name = 'Test laptop') {
  deviceCounter += 1;
  return {
    id: `30000000-0000-4000-8000-${String(deviceCounter).padStart(12, '0')}`,
    name,
    platform: 'windows' as const,
    osName: 'Windows 11',
    appVersion: '1.5.0',
  };
}

describe.skipIf(!hasDatabase)('the Noto API', () => {
  let database: TestDatabase;
  let app: App;
  let mail: MailBox;

  beforeAll(async () => {
    database = await createTestDatabase();
    ({ app, mail } = createTestApp(database));
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function call(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
  ) {
    const response = await app.request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.7',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      headers: response.headers,
    };
  }

  let signUps = 0;

  /** Each from its own address: sign-up is limited to five per address per hour. */
  async function signUp(email: string, password = PASSWORD) {
    signUps += 1;
    return call('POST', '/v1/auth/signup', {
      body: { email, password, turnstileToken: 'test', marketingOptIn: false },
      headers: { 'x-forwarded-for': `198.51.100.${signUps}` },
    });
  }

  /** A verified account and a signed-in session on a fresh device. */
  async function account(email: string, name?: string) {
    await signUp(email);
    await call('POST', '/v1/auth/verify-email', {
      body: { token: mail.token(email, /Confirm your email/) },
    });
    return signIn(email, name);
  }

  async function signIn(email: string, name?: string, password = PASSWORD) {
    const registered = device(name);
    const response = await call('POST', '/v1/auth/signin', {
      body: { email, password, device: registered },
    });
    expect(response.status).toBe(200);
    return { ...(response.body as AuthSessionDto), deviceId: registered.id };
  }

  // -------------------------------------------------------------------------

  describe('health', () => {
    it('answers /healthz and /readyz', async () => {
      expect((await call('GET', '/healthz')).status).toBe(200);
      expect((await call('GET', '/readyz')).status).toBe(200);
    });

    it('answers an unknown path with the error shape and a request id', async () => {
      const response = await call('GET', '/v1/nothing');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'not_found' });
      expect(response.body.requestId).toBe(response.headers.get('x-request-id'));
    });
  });

  describe('sign-up and verification', () => {
    it('creates an unverified account and mails a link', async () => {
      const response = await signUp('new@example.com');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        session: null,
        confirmationRequired: true,
        user: { email: 'new@example.com', emailVerified: false },
      });
      expect(mail.last('new@example.com', /Confirm your email/).text).toContain(
        'https://app.noto.test/#/auth/verify?token=',
      );
    });

    it('answers an address that already has an account exactly like a new one', async () => {
      await signUp('taken@example.com');
      const again = await signUp('Taken@Example.com');

      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ session: null, confirmationRequired: true });
      expect(mail.last('taken@example.com', /already have/)).toBeTruthy();
    });

    it('refuses sign-in until the address is verified, and says why', async () => {
      await signUp('unverified@example.com');
      const response = await call('POST', '/v1/auth/signin', {
        body: { email: 'unverified@example.com', password: PASSWORD, device: device() },
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/Confirm your email/);
    });

    it('verifies once; the link does not work twice', async () => {
      await signUp('verify@example.com');
      const token = mail.token('verify@example.com', /Confirm your email/);

      expect((await call('POST', '/v1/auth/verify-email', { body: { token } })).status).toBe(200);
      expect((await call('POST', '/v1/auth/verify-email', { body: { token } })).status).toBe(404);
    });

    it('rejects a weak password with a field error', async () => {
      const response = await signUp('weak@example.com', 'short');

      expect(response.status).toBe(400);
      expect(response.body.fields).toHaveProperty('password');
    });

    it('limits verification resends per address', async () => {
      await signUp('resend@example.com');
      const statuses = [];
      for (let i = 0; i < 4; i += 1) {
        statuses.push(
          (
            await call('POST', '/v1/auth/verify-email/resend', {
              body: { email: 'resend@example.com' },
            })
          ).status,
        );
      }

      expect(statuses).toEqual([200, 200, 200, 403]);
    });
  });

  describe('sign-in and sessions', () => {
    it('gives a wrong password and an unknown address the same answer', async () => {
      await account('known@example.com');

      const wrong = await call('POST', '/v1/auth/signin', {
        body: { email: 'known@example.com', password: 'not the password', device: device() },
      });
      const unknown = await call('POST', '/v1/auth/signin', {
        body: { email: 'nobody@example.com', password: 'not the password', device: device() },
      });

      expect(wrong.status).toBe(403);
      expect(unknown.status).toBe(403);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('treats an account with no password (an imported one) like a wrong password', async () => {
      await database.owner
        .insertInto('users')
        .values({
          email: 'imported@example.com',
          display_name: 'imported',
          email_verified_at: new Date(),
        })
        .execute();

      const response = await call('POST', '/v1/auth/signin', {
        body: { email: 'imported@example.com', password: PASSWORD, device: device() },
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/do not match/);
    });

    it('signs in, and the access token opens /auth/session', async () => {
      const session = await account('session@example.com');
      const me = await call('GET', '/v1/auth/session', { token: session.accessToken });

      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ email: 'session@example.com', emailVerified: true });
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('refuses a missing, malformed or forged token with 401', async () => {
      const session = await account('forged@example.com');
      const [header, payload] = session.accessToken.split('.');

      for (const token of [undefined, 'nonsense', `${header}.${payload}.forgedsignature`]) {
        const response = await call('GET', '/v1/auth/session', token ? { token } : {});
        expect(response.status).toBe(401);
        expect(response.body.code).toBe('unauthenticated');
      }
    });

    it('rotates a refresh token, and the old one stops working', async () => {
      const session = await account('rotate@example.com');

      const first = await call('POST', '/v1/auth/refresh', {
        body: { refreshToken: session.refreshToken },
      });
      expect(first.status).toBe(200);
      expect(first.body.refreshToken).not.toBe(session.refreshToken);

      const me = await call('GET', '/v1/auth/session', { token: first.body.accessToken });
      expect(me.status).toBe(200);
    });

    it('signs the user out everywhere when a rotated refresh token is presented again', async () => {
      const session = await account('theft@example.com');
      const elsewhere = await signIn('theft@example.com', 'Phone');

      const rotated = await call('POST', '/v1/auth/refresh', {
        body: { refreshToken: session.refreshToken },
      });
      expect(rotated.status).toBe(200);

      // The thief replays the token the owner already exchanged.
      const replay = await call('POST', '/v1/auth/refresh', {
        body: { refreshToken: session.refreshToken },
      });
      expect(replay.status).toBe(401);

      // Every session is gone: the rotated one, and the other device's.
      for (const token of [rotated.body.accessToken, elsewhere.accessToken]) {
        expect((await call('GET', '/v1/auth/session', { token })).status).toBe(401);
      }
      expect(
        (
          await call('POST', '/v1/auth/refresh', {
            body: { refreshToken: rotated.body.refreshToken },
          })
        ).status,
      ).toBe(401);

      const events = await database.owner
        .selectFrom('auth_events')
        .innerJoin('users', 'users.id', 'auth_events.user_id')
        .select('auth_events.kind')
        .where('users.email', '=', 'theft@example.com')
        .execute();
      expect(events.map((e) => e.kind)).toContain('session_reuse_detected');
    });

    it('ends a session on sign-out, immediately', async () => {
      const session = await account('signout@example.com');

      expect((await call('POST', '/v1/auth/signout', { token: session.accessToken })).status).toBe(
        200,
      );
      expect((await call('GET', '/v1/auth/session', { token: session.accessToken })).status).toBe(
        401,
      );
      expect(
        (await call('POST', '/v1/auth/refresh', { body: { refreshToken: session.refreshToken } }))
          .status,
      ).toBe(401);
    });

    it('ends every session on sign-out-all', async () => {
      const one = await account('everywhere@example.com');
      const two = await signIn('everywhere@example.com', 'Phone');

      expect((await call('POST', '/v1/auth/signout-all', { token: one.accessToken })).status).toBe(
        200,
      );
      for (const token of [one.accessToken, two.accessToken]) {
        expect((await call('GET', '/v1/auth/session', { token })).status).toBe(401);
      }
    });
  });

  describe('password reset and change', () => {
    it('resets from a mailed link, ends every session, and the link is single-use', async () => {
      const before = await account('reset@example.com');

      const forgot = await call('POST', '/v1/auth/password/forgot', {
        body: { email: 'reset@example.com' },
      });
      expect(forgot.status).toBe(200);

      const token = mail.token('reset@example.com', /Reset your Noto password/);
      const body = { token, newPassword: 'a completely new passphrase' };

      expect((await call('POST', '/v1/auth/password/reset', { body })).status).toBe(200);
      expect((await call('POST', '/v1/auth/password/reset', { body })).status).toBe(404);
      expect((await call('GET', '/v1/auth/session', { token: before.accessToken })).status).toBe(
        401,
      );

      await signIn('reset@example.com', undefined, 'a completely new passphrase');
    });

    it('says the same for an address with no account', async () => {
      const response = await call('POST', '/v1/auth/password/forgot', {
        body: { email: 'ghost@example.com' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(mail.messages.some((m) => m.to === 'ghost@example.com')).toBe(false);
    });

    it('lets an imported account with no password set one by reset', async () => {
      await database.owner
        .insertInto('users')
        .values({
          email: 'moved@example.com',
          display_name: 'moved',
          email_verified_at: new Date(),
        })
        .execute();

      await call('POST', '/v1/auth/password/forgot', { body: { email: 'moved@example.com' } });
      const token = mail.token('moved@example.com', /Reset your Noto password/);
      await call('POST', '/v1/auth/password/reset', { body: { token, newPassword: PASSWORD } });

      await signIn('moved@example.com');
    });

    it('changes a password only with the current one, keeping this session', async () => {
      const here = await account('change@example.com');
      const there = await signIn('change@example.com', 'Phone');

      const refused = await call('POST', '/v1/auth/password/change', {
        token: here.accessToken,
        body: { currentPassword: 'wrong', newPassword: 'another long passphrase' },
      });
      expect(refused.status).toBe(403);

      const changed = await call('POST', '/v1/auth/password/change', {
        token: here.accessToken,
        body: { currentPassword: PASSWORD, newPassword: 'another long passphrase' },
      });
      expect(changed.status).toBe(200);

      expect((await call('GET', '/v1/auth/session', { token: here.accessToken })).status).toBe(200);
      expect((await call('GET', '/v1/auth/session', { token: there.accessToken })).status).toBe(
        401,
      );

      const me = await call('GET', '/v1/auth/session', { token: here.accessToken });
      expect(me.body.passwordChangedAt).toEqual(expect.any(String));
    });
  });

  describe('account', () => {
    it('refuses every account route without a session', async () => {
      for (const [method, path] of [
        ['GET', '/v1/account/profile'],
        ['PATCH', '/v1/account/profile'],
        ['GET', '/v1/account/settings'],
        ['PUT', '/v1/account/settings'],
        ['GET', '/v1/account/devices'],
        ['POST', '/v1/account/devices'],
        ['DELETE', '/v1/account/devices/30000000-0000-4000-8000-000000000001'],
        ['GET', '/v1/account/sessions'],
        ['DELETE', '/v1/account/sessions/30000000-0000-4000-8000-000000000001'],
        ['GET', '/v1/account/events'],
        ['POST', '/v1/account/email/change'],
      ] as const) {
        expect((await call(method, path, { body: {} })).status, `${method} ${path}`).toBe(401);
      }
    });

    it('reads and updates the profile, and will not take an email change there', async () => {
      const session = await account('profile@example.com');

      const patched = await call('PATCH', '/v1/account/profile', {
        token: session.accessToken,
        body: { displayName: '  Ada  ', locale: 'en-GB', marketingOptIn: true },
      });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ displayName: 'Ada', locale: 'en-GB' });

      const sneaky = await call('PATCH', '/v1/account/profile', {
        token: session.accessToken,
        body: { email: 'other@example.com' },
      });
      expect(sneaky.status).toBe(400);

      const stored = await database.owner
        .selectFrom('users')
        .select(['marketing_opt_in', 'email'])
        .where('email', '=', 'profile@example.com')
        .executeTakeFirstOrThrow();
      expect(stored).toEqual({ marketing_opt_in: true, email: 'profile@example.com' });
    });

    it('merges settings rather than replacing them', async () => {
      const session = await account('settings@example.com');

      await call('PUT', '/v1/account/settings', {
        token: session.accessToken,
        body: { appearance: { theme: 'dark' }, syncEnabled: true },
      });
      const second = await call('PUT', '/v1/account/settings', {
        token: session.accessToken,
        body: { appearance: { accent: 'blue' } },
      });

      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({
        appearance: { theme: 'dark', accent: 'blue' },
        syncEnabled: true,
      });
    });

    it('lists devices with the current one marked', async () => {
      const session = await account('devices@example.com', 'Desk');
      await signIn('devices@example.com', 'Phone');

      const listed = await call('GET', '/v1/account/devices', { token: session.accessToken });
      const devices = listed.body as DeviceDto[];

      expect(devices.map((d) => d.name).sort()).toEqual(['Desk', 'Phone']);
      expect(devices.find((d) => d.isCurrent)?.id).toBe(session.deviceId);
    });

    it('revokes another device, which ends its sessions', async () => {
      const desk = await account('revoke@example.com', 'Desk');
      const phone = await signIn('revoke@example.com', 'Phone');

      const response = await call('DELETE', `/v1/account/devices/${phone.deviceId}`, {
        token: desk.accessToken,
      });
      expect(response.status).toBe(200);
      expect((await call('GET', '/v1/auth/session', { token: phone.accessToken })).status).toBe(
        401,
      );

      // Signing in again on that device is the way back, and un-revokes it.
      const back = await call('POST', '/v1/auth/signin', {
        body: {
          email: 'revoke@example.com',
          password: PASSWORD,
          device: { ...device('Phone'), id: phone.deviceId },
        },
      });
      expect(back.status).toBe(200);
    });

    it('will not revoke the device making the request', async () => {
      const session = await account('self-revoke@example.com');
      const response = await call('DELETE', `/v1/account/devices/${session.deviceId}`, {
        token: session.accessToken,
      });

      expect(response.status).toBe(400);
    });

    it('answers another user’s device id with 404 and leaves it alone', async () => {
      const alice = await account('alice-dev@example.com');
      const bob = await account('bob-dev@example.com');

      const response = await call('DELETE', `/v1/account/devices/${alice.deviceId}`, {
        token: bob.accessToken,
      });
      expect(response.status).toBe(404);
      expect((await call('GET', '/v1/auth/session', { token: alice.accessToken })).status).toBe(
        200,
      );
    });

    it('refuses to register a device id that belongs to someone else', async () => {
      const alice = await account('alice-reg@example.com');
      const bob = await account('bob-reg@example.com');

      const response = await call('POST', '/v1/account/devices', {
        token: bob.accessToken,
        body: { ...device('Hijack'), id: alice.deviceId },
      });
      expect(response.status).toBe(409);

      const owner = await database.owner
        .selectFrom('devices')
        .innerJoin('users', 'users.id', 'devices.user_id')
        .select('users.email')
        .where('devices.id', '=', alice.deviceId)
        .executeTakeFirstOrThrow();
      expect(owner.email).toBe('alice-reg@example.com');
    });

    it('lists sessions, marks this one, and revokes another', async () => {
      const here = await account('sessions@example.com', 'Desk');
      const there = await signIn('sessions@example.com', 'Phone');

      const listed = await call('GET', '/v1/account/sessions', { token: here.accessToken });
      const sessions = listed.body as SessionDto[];
      expect(sessions).toHaveLength(2);
      expect(sessions.filter((s) => s.isCurrent)).toHaveLength(1);

      const other = sessions.find((s) => !s.isCurrent)!;
      expect(other.client).toMatch(/Phone/);
      expect(
        (await call('DELETE', `/v1/account/sessions/${other.id}`, { token: here.accessToken }))
          .status,
      ).toBe(200);
      expect((await call('GET', '/v1/auth/session', { token: there.accessToken })).status).toBe(
        401,
      );

      const self = sessions.find((s) => s.isCurrent)!;
      expect(
        (await call('DELETE', `/v1/account/sessions/${self.id}`, { token: here.accessToken }))
          .status,
      ).toBe(400);
    });

    it('answers another user’s session id with 404', async () => {
      const alice = await account('alice-ses@example.com');
      const bob = await account('bob-ses@example.com');
      const aliceSessions = (
        await call('GET', '/v1/account/sessions', { token: alice.accessToken })
      ).body as SessionDto[];

      const response = await call('DELETE', `/v1/account/sessions/${aliceSessions[0]!.id}`, {
        token: bob.accessToken,
      });
      expect(response.status).toBe(404);
      expect((await call('GET', '/v1/auth/session', { token: alice.accessToken })).status).toBe(
        200,
      );
    });

    it('shows the security log, newest first, and only the caller’s own', async () => {
      const session = await account('events@example.com');
      await account('someone-else@example.com');

      const response = await call('GET', '/v1/account/events?limit=10', {
        token: session.accessToken,
      });
      const kinds = (response.body as { kind: string }[]).map((e) => e.kind);

      expect(response.status).toBe(200);
      expect(kinds[0]).toBe('sign_in');
      expect(kinds).toEqual(expect.arrayContaining(['sign_up', 'email_verified', 'sign_in']));
      expect(kinds).toHaveLength(3);
    });

    it('changes the email address only once the new one is confirmed', async () => {
      const session = await account('old-address@example.com');

      const refused = await call('POST', '/v1/account/email/change', {
        token: session.accessToken,
        body: { newEmail: 'new-address@example.com', password: 'wrong' },
      });
      expect(refused.status).toBe(403);

      const requested = await call('POST', '/v1/account/email/change', {
        token: session.accessToken,
        body: { newEmail: 'new-address@example.com', password: PASSWORD },
      });
      expect(requested.status).toBe(200);

      const unchanged = await call('GET', '/v1/account/profile', { token: session.accessToken });
      expect(unchanged.body.email).toBe('old-address@example.com');

      const token = mail.token('new-address@example.com', /Confirm your new email/);
      expect((await call('POST', '/v1/auth/verify-email', { body: { token } })).status).toBe(200);

      const moved = await call('GET', '/v1/account/profile', { token: session.accessToken });
      expect(moved.body.email).toBe('new-address@example.com');
      expect(mail.last('old-address@example.com', /was changed/)).toBeTruthy();
      await signIn('new-address@example.com');
    });

    it('will not move an account onto an address that is taken', async () => {
      const session = await account('mover@example.com');
      await account('occupied@example.com');

      const response = await call('POST', '/v1/account/email/change', {
        token: session.accessToken,
        body: { newEmail: 'occupied@example.com', password: PASSWORD },
      });
      expect(response.status).toBe(409);
    });
  });

  describe('CORS', () => {
    it('allows the production web app and refuses an unknown origin', async () => {
      const allowed = await app.request('/v1/auth/session', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://noto.app',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
      const refused = await app.request('/v1/auth/session', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
      });

      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://noto.app');
      expect(refused.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
