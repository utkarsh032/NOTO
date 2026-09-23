import { describe, expect, it } from 'vitest';

import { isAllowedRedirect } from './index.ts';

describe('isAllowedRedirect', () => {
  it('allows the deep link, Noto’s own origins and localhost', () => {
    expect(isAllowedRedirect('noto://auth/callback')).toBe(true);
    expect(isAllowedRedirect('https://noto.app/#/login')).toBe(true);
    expect(isAllowedRedirect('https://noto-web.utkarshraj525.workers.dev/')).toBe(true);
    expect(isAllowedRedirect('http://localhost:5000/#/login')).toBe(true);
    expect(isAllowedRedirect('http://127.0.0.1:5173/')).toBe(true);
  });

  it('refuses any other https origin', () => {
    expect(isAllowedRedirect('https://evil.test/callback')).toBe(false);
    expect(isAllowedRedirect('https://noto.app.evil.test/')).toBe(false);
  });

  it('refuses a host that merely starts with localhost', () => {
    expect(isAllowedRedirect('http://localhost.evil.test/')).toBe(false);
  });

  it('refuses other schemes and non-URLs', () => {
    expect(isAllowedRedirect('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirect('http://noto.app/')).toBe(false);
    expect(isAllowedRedirect('not a url')).toBe(false);
  });
});
