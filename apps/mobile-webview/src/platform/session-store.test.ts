import { describe, expect, it, vi } from 'vitest';

import { parseStoredSession } from './session-store';

// The bridge installs itself on `window` when it loads; tests run in Node.
vi.hoisted(() => {
  Object.assign(globalThis, { window: globalThis });
});

const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: '2026-09-23T12:00:00.000Z',
};

describe('parseStoredSession', () => {
  it('accepts a session', () => {
    expect(parseStoredSession(session)).toEqual(session);
  });

  it('keeps only the three fields', () => {
    expect(parseStoredSession({ ...session, user: { id: 'u1' } })).toEqual(session);
  });

  it('refuses nothing, and things that are not a session', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('token')).toBeNull();
    expect(parseStoredSession({ ...session, accessToken: '' })).toBeNull();
    expect(parseStoredSession({ ...session, refreshToken: 42 })).toBeNull();
    expect(parseStoredSession({ ...session, expiresAt: 'soon' })).toBeNull();
  });
});
