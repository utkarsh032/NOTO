import { describe, expect, it } from 'vitest';

import { readEnv } from '../src/env.ts';
import { createMailLinks } from '../src/mail.ts';
import { createArgon2Hasher } from '../src/security/passwords.ts';
import { createAccessTokens } from '../src/security/tokens.ts';

/** The parts of the server that need no database. */

const SECRET = 'a-test-secret-that-is-long-enough-for-hs256';

describe('access tokens', () => {
  it('round-trips the claims', async () => {
    const tokens = createAccessTokens({ secret: SECRET, ttlSeconds: 900 });
    const { token, expiresAt } = await tokens.issue({
      userId: 'u1',
      sessionId: 's1',
      deviceId: 'd1',
    });

    expect(await tokens.verify(token)).toEqual({ userId: 'u1', sessionId: 's1', deviceId: 'd1' });
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(890_000);
  });

  it('rejects a token signed with another secret', async () => {
    const theirs = createAccessTokens({ secret: `${SECRET}-other`, ttlSeconds: 900 });
    const ours = createAccessTokens({ secret: SECRET, ttlSeconds: 900 });
    const { token } = await theirs.issue({ userId: 'u1', sessionId: 's1', deviceId: null });

    expect(await ours.verify(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const tokens = createAccessTokens({ secret: SECRET, ttlSeconds: -60 });
    const { token } = await tokens.issue({ userId: 'u1', sessionId: 's1', deviceId: null });

    expect(await tokens.verify(token)).toBeNull();
  });

  it('rejects an unsigned token (alg: none)', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'u1',
      sid: 's1',
      iss: 'noto-api',
      aud: 'noto',
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;

    const tokens = createAccessTokens({ secret: SECRET, ttlSeconds: 900 });
    expect(await tokens.verify(token)).toBeNull();
  });
});

describe('argon2 hasher', () => {
  it('verifies the right password and refuses the wrong one', async () => {
    const hasher = createArgon2Hasher();
    const hash = await hasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await hasher.verify(hash, 'correct horse battery staple')).toBe(true);
    expect(await hasher.verify(hash, 'wrong')).toBe(false);
  });

  it('treats a malformed stored hash as a failed check', async () => {
    expect(await createArgon2Hasher().verify('not-a-hash', 'anything')).toBe(false);
  });
});

describe('environment', () => {
  const minimal = {
    DATABASE_URL: 'postgres://noto_api:x@localhost:5432/noto',
    DATABASE_SERVICE_URL: 'postgres://noto_service:x@localhost:5432/noto',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('fills defaults and parses durations', () => {
    const env = readEnv(minimal);

    expect(env.ACCESS_TOKEN_TTL).toBe(900);
    expect(env.REFRESH_TOKEN_TTL).toBe(30 * 86_400);
    expect(env.PORT).toBe(8787);
  });

  it('names every problem at once', () => {
    expect(() => readEnv({ JWT_SECRET: 'short' })).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('refuses a production process that would skip the bot check or mail nobody', () => {
    expect(() => readEnv({ ...minimal, NODE_ENV: 'production' })).toThrow(
      /TURNSTILE_SECRET[\s\S]*RESEND_API_KEY/,
    );
  });

  it('refuses localhost origins in production', () => {
    expect(() =>
      readEnv({
        ...minimal,
        NODE_ENV: 'production',
        TURNSTILE_SECRET: 's',
        TURNSTILE_HOSTNAMES: 'noto.app',
        RESEND_API_KEY: 'r',
        NOTO_ALLOW_LOCALHOST_ORIGINS: 'true',
      }),
    ).toThrow(/Localhost origins/);
  });
});

describe('mail links', () => {
  it('puts the token in the fragment, where no server log sees it', () => {
    const links = createMailLinks('https://noto.app/');

    expect(links.verifyEmail('abc')).toBe('https://noto.app/#/auth/verify?token=abc');
    expect(links.resetPassword('abc')).toBe('https://noto.app/#/auth/reset?token=abc');
  });
});
