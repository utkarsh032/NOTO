import { err } from '@noto/core';
import { describe, expect, it } from 'vitest';

import type { CallerIdentity } from '../ports/index.ts';
import {
  FakeAuditPort,
  FakeAuthPort,
  FakeIdentityPort,
  FakeRateLimitPort,
} from '../testing/index.ts';
import { IdentityService } from './identity-service.ts';

const CALLER: CallerIdentity = { userId: 'user-1', sessionId: 'session-1', deviceId: null };
const TOKEN = 'a'.repeat(64);

function makeService(options: { auth?: FakeAuthPort; rateLimit?: FakeRateLimitPort } = {}) {
  const identity = new FakeIdentityPort();
  const audit = new FakeAuditPort();
  const rateLimit = options.rateLimit ?? new FakeRateLimitPort();
  const auth = options.auth ?? new FakeAuthPort();
  const service = new IdentityService({ auth, identity, audit, rateLimit });

  identity.passwords.set('user-1', 'correct horse battery');
  identity.sessions.set('session-1', { userId: 'user-1', revoked: false });
  identity.sessions.set('session-2', { userId: 'user-1', revoked: false });
  identity.sessions.set('session-9', { userId: 'user-9', revoked: false });

  return { service, identity, audit, rateLimit };
}

describe('IdentityService.refresh', () => {
  it('rejects a body without a token before touching storage', async () => {
    const { service } = makeService();
    const result = await service.refresh({});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_input');
  });

  it('records a detected token reuse against its owner', async () => {
    const auth = new FakeAuthPort();
    auth.refresh = async () =>
      err('permission_denied', 'This session has ended.', {
        code: 'refresh_token_reused',
        userId: 'user-1',
      });
    const { service, audit } = makeService({ auth });

    const result = await service.refresh({ refreshToken: TOKEN });

    expect(result.ok).toBe(false);
    expect(audit.events).toContainEqual(
      expect.objectContaining({
        userId: 'user-1',
        kind: 'session_reuse_detected',
        outcome: 'failure',
      }),
    );
  });

  it('does not log an ordinary expired token as theft', async () => {
    const { service, audit } = makeService();
    await service.refresh({ refreshToken: TOKEN });

    expect(audit.events).toHaveLength(0);
  });
});

describe('IdentityService.changePassword', () => {
  it('refuses the wrong current password and counts the guess', async () => {
    const { service, identity, rateLimit } = makeService();

    const result = await service.changePassword(CALLER, {
      currentPassword: 'wrong guess here',
      newPassword: 'a brand new passphrase',
      signOutOtherDevices: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('permission_denied');
    expect(identity.passwordChanges).toHaveLength(0);
    expect(rateLimit.attempts).toEqual([{ key: 'user:user-1', kind: 'sign_in' }]);
  });

  it('stops checking after five wrong guesses, even with the right password', async () => {
    const { service, identity } = makeService();
    const wrong = {
      currentPassword: 'wrong guess here',
      newPassword: 'a brand new passphrase',
      signOutOtherDevices: true,
    };

    for (let i = 0; i < 5; i += 1) await service.changePassword(CALLER, wrong);
    const result = await service.changePassword(CALLER, {
      ...wrong,
      currentPassword: 'correct horse battery',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/Too many attempts/);
    expect(identity.passwordChanges).toHaveLength(0);
  });

  it('keeps the current session and ends the others when asked to', async () => {
    const { service, identity, audit } = makeService();

    const result = await service.changePassword(CALLER, {
      currentPassword: 'correct horse battery',
      newPassword: 'a brand new passphrase',
      signOutOtherDevices: true,
    });

    expect(result.ok).toBe(true);
    expect(identity.passwordChanges).toEqual([{ userId: 'user-1', keepSessionId: 'session-1' }]);
    expect(audit.events).toContainEqual(
      expect.objectContaining({ kind: 'password_changed', outcome: 'success' }),
    );
  });

  it('applies the length rule to the new password', async () => {
    const { service, identity } = makeService();

    const result = await service.changePassword(CALLER, {
      currentPassword: 'correct horse battery',
      newPassword: 'short',
      signOutOtherDevices: false,
    });

    expect(result.ok).toBe(false);
    expect(identity.passwordChanges).toHaveLength(0);
  });
});

describe('IdentityService sessions', () => {
  it('marks the caller’s own session', async () => {
    const { service } = makeService();
    const result = await service.listSessions(CALLER);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((s) => [s.id, s.isCurrent])).toEqual([
        ['session-1', true],
        ['session-2', false],
      ]);
    }
  });

  it('will not revoke the session making the request', async () => {
    const { service, identity } = makeService();
    const result = await service.revokeSession(CALLER, 'session-1');

    expect(result.ok).toBe(false);
    expect(identity.sessions.get('session-1')?.revoked).toBe(false);
  });

  it('cannot revoke another user’s session', async () => {
    const { service, identity } = makeService();
    const result = await service.revokeSession(CALLER, 'session-9');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
    expect(identity.sessions.get('session-9')?.revoked).toBe(false);
  });
});

describe('IdentityService mailed tokens', () => {
  it('verifies an address once, and audits it', async () => {
    const { service, identity, audit } = makeService();
    identity.emailTokens.set(TOKEN, { userId: 'user-1', kind: 'verify_email' });

    expect((await service.verifyEmail({ token: TOKEN })).ok).toBe(true);
    expect((await service.verifyEmail({ token: TOKEN })).ok).toBe(false);
    expect(audit.events).toContainEqual(
      expect.objectContaining({ userId: 'user-1', kind: 'email_verified' }),
    );
  });

  it('limits verification resends to three an hour per address', async () => {
    const { service, identity } = makeService();

    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await service.resendVerification({ email: 'Someone@Example.com' }));
    }

    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(identity.resendRequests).toHaveLength(3);
  });

  it('answers a reset request for an unknown address exactly like a known one', async () => {
    const auth = new FakeAuthPort();
    const { service } = makeService({ auth });

    const result = await service.forgotPassword(
      { email: 'nobody@example.com' },
      { ip: '203.0.113.9' },
    );

    expect(result).toEqual({ ok: true, value: { ok: true } });
    expect(auth.resetRequests).toEqual(['nobody@example.com']);
  });

  it('fails closed when the rate limiter is unreachable', async () => {
    const { service } = makeService({ rateLimit: new FakeRateLimitPort({ unavailable: true }) });
    const result = await service.forgotPassword({ email: 'someone@example.com' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('storage_unavailable');
  });

  it('resets a password from a token, which then cannot be reused', async () => {
    const { service, identity, audit } = makeService();
    identity.resetTokens.set(TOKEN, 'user-1');

    const body = { token: TOKEN, newPassword: 'a brand new passphrase' };
    expect((await service.resetPassword(body)).ok).toBe(true);
    expect((await service.resetPassword(body)).ok).toBe(false);
    expect(identity.passwords.get('user-1')).toBe('a brand new passphrase');
    expect(audit.events).toContainEqual(expect.objectContaining({ kind: 'password_reset' }));
  });

  it('requires the password before starting an email change', async () => {
    const { service, identity } = makeService();

    const refused = await service.requestEmailChange(CALLER, {
      newEmail: 'new@example.com',
      password: 'wrong guess here',
    });
    const accepted = await service.requestEmailChange(CALLER, {
      newEmail: 'New@Example.com',
      password: 'correct horse battery',
    });

    expect(refused.ok).toBe(false);
    expect(accepted.ok).toBe(true);
    expect(identity.emailChanges).toEqual([{ userId: 'user-1', newEmail: 'new@example.com' }]);
  });
});
