import { describe, expect, it } from 'vitest';

import { compareVersions, isNewerVersion, parseVersion } from './version.ts';

describe('parseVersion', () => {
  it('reads a release, with or without the tag prefix', () => {
    expect(parseVersion('1.2.0')).toEqual({ major: 1, minor: 2, patch: 0, prerelease: [] });
    expect(parseVersion('v1.2.0')).toEqual({ major: 1, minor: 2, patch: 0, prerelease: [] });
  });

  it('splits a prerelease into its identifiers, numbers as numbers', () => {
    expect(parseVersion('v1.3.0-beta.1')?.prerelease).toEqual(['beta', 1]);
  });

  it('ignores build metadata', () => {
    expect(parseVersion('1.2.0+20260831')?.patch).toBe(0);
  });

  it('returns null for anything it cannot read', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.2.1', '1.2.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
  });

  it('puts a prerelease behind the release it leads to', () => {
    expect(compareVersions('1.3.0-beta.1', '1.3.0')).toBeLessThan(0);
    expect(compareVersions('1.3.0', '1.3.0-nightly.7')).toBeGreaterThan(0);
  });

  it('orders prereleases among themselves', () => {
    expect(compareVersions('1.3.0-beta.1', '1.3.0-beta.2')).toBeLessThan(0);
    expect(compareVersions('1.3.0-beta', '1.3.0-beta.1')).toBeLessThan(0);
    expect(compareVersions('1.3.0-alpha.1', '1.3.0-beta.1')).toBeLessThan(0);
  });

  it('treats an unreadable version as no answer rather than as older', () => {
    expect(compareVersions('nightly', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0', '')).toBe(0);
  });
});

describe('isNewerVersion', () => {
  it('is true only for a release the user does not have', () => {
    expect(isNewerVersion('1.3.0', '1.2.0')).toBe(true);
    expect(isNewerVersion('1.2.0', '1.2.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.2.0')).toBe(false);
  });

  it('never offers an update it could not parse', () => {
    expect(isNewerVersion('the latest one', '1.2.0')).toBe(false);
  });
});
