import { describe, expect, it } from 'vitest';

import { LOCK_GRACE_MS, lockMethodLabel, shouldLockOnReturn } from './app-lock-policy';

describe('shouldLockOnReturn', () => {
  it('never locks while the lock is off', () => {
    expect(shouldLockOnReturn(false, 0, LOCK_GRACE_MS * 10)).toBe(false);
  });

  it('does not lock without a trip to the background', () => {
    expect(shouldLockOnReturn(true, null, 1_000_000)).toBe(false);
  });

  it('lets a short trip through', () => {
    expect(shouldLockOnReturn(true, 1_000, 1_000 + LOCK_GRACE_MS - 1)).toBe(false);
  });

  it('locks once the grace period has passed', () => {
    expect(shouldLockOnReturn(true, 1_000, 1_000 + LOCK_GRACE_MS)).toBe(true);
  });
});

describe('lockMethodLabel', () => {
  it('has nothing to lock with on a phone with no screen lock', () => {
    expect(lockMethodLabel('android', 0, [1])).toBeNull();
  });

  it('names the passcode when no biometrics are enrolled', () => {
    expect(lockMethodLabel('ios', 1, [2])).toBe('passcode');
    expect(lockMethodLabel('android', 1, [1])).toBe('screen lock');
  });

  it("uses each platform's own name for biometrics", () => {
    expect(lockMethodLabel('ios', 3, [2])).toBe('Face ID');
    expect(lockMethodLabel('ios', 3, [1])).toBe('Touch ID');
    expect(lockMethodLabel('android', 2, [2, 1])).toBe('face unlock');
    expect(lockMethodLabel('android', 3, [1])).toBe('fingerprint');
    expect(lockMethodLabel('android', 2, [3])).toBe('iris unlock');
  });
});
