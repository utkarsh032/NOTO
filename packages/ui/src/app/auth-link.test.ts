import { describe, expect, it } from 'vitest';

import { parseAuthLink } from './auth-link';
import { parseRoute } from './router';

describe('parseAuthLink', () => {
  it('reads the links apps/api sends', () => {
    expect(parseAuthLink(parseRoute('#/auth/verify?token=abc_123').param)).toEqual({
      kind: 'verify',
      token: 'abc_123',
    });
    expect(parseAuthLink(parseRoute('#/auth/reset?token=x-y').param)).toEqual({
      kind: 'reset',
      token: 'x-y',
    });
  });

  it('routes the link to the auth screen', () => {
    expect(parseRoute('#/auth/verify?token=abc').name).toBe('auth');
  });

  it('has nothing to act on without a kind or a token', () => {
    expect(parseAuthLink(undefined)).toEqual({ kind: null, token: null });
    expect(parseAuthLink('verify')).toEqual({ kind: 'verify', token: null });
    expect(parseAuthLink('verify?token=')).toEqual({ kind: 'verify', token: null });
    expect(parseAuthLink('delete?token=abc')).toEqual({ kind: null, token: 'abc' });
  });
});
