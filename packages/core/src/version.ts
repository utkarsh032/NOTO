/**
 * Comparing release versions.
 *
 * Noto asks GitHub what the newest release is and has to decide whether it is
 * newer than the build the user is running. That is a comparison, not a string
 * match: `1.10.0` is ahead of `1.9.0`, and `1.3.0-beta.1` is behind `1.3.0`
 * even though it sorts after it alphabetically.
 *
 * Only the subset of semver Noto actually publishes is understood — the tag
 * shapes in `UPDATE_CHANNELS`. Anything else parses to `null` and is treated as
 * "cannot tell", which the update checker reads as "no update", because
 * offering someone a version you could not parse is worse than staying quiet.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /**
   * The dot-separated identifiers after `-`, e.g. `['beta', 1]`. Empty for a
   * stable release, which by semver's rule outranks any prerelease of it.
   */
  prerelease: (string | number)[];
}

/** `1.2.0`, `v1.2.0`, `1.3.0-beta.1`. Build metadata after `+` is ignored. */
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(version: string): ParsedVersion | null {
  const match = VERSION.exec(version.trim());
  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease
      ? prerelease.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

/** Semver's rule: numbers compare numerically, identifiers ASCII, numbers first. */
function comparePrerelease(a: (string | number)[], b: (string | number)[]): number {
  // A release with no prerelease part is the finished one, and wins.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index];
    const right = b[index];

    // The shorter run of identifiers is the lower version: beta < beta.1.
    if (left === undefined) return -1;
    if (right === undefined) return 1;

    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left < right ? -1 : 1;
      continue;
    }

    if (typeof left === 'number') return -1;
    if (typeof right === 'number') return 1;
    if (left !== right) return left < right ? -1 : 1;
  }

  return 0;
}

/**
 * Orders two versions: negative when `a` is older, positive when it is newer,
 * zero when they are the same release. Unparseable versions sort as equal, so
 * a caller comparing against garbage never concludes an update exists.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;

  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;

  return comparePrerelease(left.prerelease, right.prerelease);
}

/** True when `candidate` is a release the user does not have yet. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
