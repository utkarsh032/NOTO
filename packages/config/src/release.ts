/**
 * Everything the applications need to know about how Noto is released.
 *
 * The website's download page, the desktop updater and the release notes all
 * describe the same set of packages. Keeping the asset naming, the channels and
 * the system requirements here means the download page cannot drift away from
 * what the release workflow actually publishes.
 *
 * The names produced by {@link assetFileName} must match
 * `scripts/collect-desktop-artifacts.mjs`.
 */

export const GITHUB_OWNER = 'utkarsh032';
export const GITHUB_REPOSITORY = 'NOTO';
export const GITHUB_SLUG = `${GITHUB_OWNER}/${GITHUB_REPOSITORY}`;

export const GITHUB_URL = `https://github.com/${GITHUB_SLUG}`;
export const RELEASES_URL = `${GITHUB_URL}/releases`;
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
export const ISSUES_URL = `${GITHUB_URL}/issues`;

/** Unauthenticated GitHub API endpoint for the newest non-prerelease release. */
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_SLUG}/releases/latest`;

/** Electron's free update service for public GitHub repositories. */
export const UPDATE_SERVICE_URL = 'https://update.electronjs.org';

// ── Update channels ──────────────────────────────────────────────────────────

export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export const DEFAULT_UPDATE_CHANNEL: UpdateChannel = 'stable';

export interface UpdateChannelInfo {
  label: string;
  description: string;
  /** Tag shape releases on this channel use. */
  tagPattern: string;
  /** Whether GitHub marks these releases as prereleases. */
  prerelease: boolean;
}

export const UPDATE_CHANNELS: Record<UpdateChannel, UpdateChannelInfo> = {
  stable: {
    label: 'Stable',
    description: 'Tested releases. This is what Noto uses unless you change it.',
    tagPattern: 'v1.0.0',
    prerelease: false,
  },
  beta: {
    label: 'Beta',
    description: 'Release candidates, a few weeks ahead of stable. Expect rough edges.',
    tagPattern: 'v1.1.0-beta.1',
    prerelease: true,
  },
  nightly: {
    label: 'Nightly',
    description: 'Development builds. Unverified, and occasionally broken.',
    tagPattern: 'v1.2.0-nightly.1',
    prerelease: true,
  },
};

// ── Platforms and packages ───────────────────────────────────────────────────

export type PlatformId = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';

export type Architecture = 'x64' | 'arm64';

export interface DownloadPackage {
  /** Label shown on the download page, e.g. "Windows 64-bit". */
  label: string;
  /** Short qualifier, e.g. "Recommended" or "Apple Silicon". */
  note?: string;
  /** File extension shown to the user. */
  format: string;
  arch?: Architecture;
  /** Resolves the release asset name for a version, or null for store links. */
  file?: (version: string) => string;
  /** Used instead of a release asset for the stores and the web application. */
  href?: string;
}

export interface PlatformInfo {
  id: PlatformId;
  label: string;
  packages: DownloadPackage[];
}

/** File-name segment used by the release pipeline for each desktop platform. */
const DESKTOP_SEGMENT: Partial<Record<PlatformId, string>> = {
  windows: 'win',
  macos: 'mac',
  linux: 'linux',
};

/**
 * Builds a release asset name, e.g. `Noto-1.0.0-win-x64.exe`.
 *
 * Must stay in step with `scripts/collect-desktop-artifacts.mjs`, which is what
 * actually names the files during a release.
 */
export function assetFileName(
  version: string,
  platform: PlatformId,
  arch: Architecture,
  extension: string,
): string {
  const segment = DESKTOP_SEGMENT[platform];
  if (!segment) throw new Error(`${platform} is not distributed as a downloadable file.`);
  return `Noto-${version}-${segment}-${arch}.${extension}`;
}

/**
 * Builds the Android release asset name, e.g. `Noto-1.0.0-android.apk`.
 *
 * There is no architecture in the name, unlike the desktop packages: the
 * release workflow builds a single APK carrying every ABI, so one file installs
 * on any phone. Must stay in step with the rename step in
 * `.github/workflows/mobile.yml`.
 */
export function androidAssetFileName(version: string, extension: 'apk' | 'aab' = 'apk'): string {
  return `Noto-${version}-android.${extension}`;
}

/** Direct download URL for a released asset. */
export function downloadUrl(version: string, fileName: string): string {
  return `${RELEASES_URL}/download/v${version}/${fileName}`;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'windows',
    label: 'Windows',
    packages: [
      {
        label: 'Windows 64-bit',
        note: 'Recommended',
        format: 'exe',
        arch: 'x64',
        file: (v) => assetFileName(v, 'windows', 'x64', 'exe'),
      },
      {
        label: 'Windows ARM64',
        format: 'exe',
        arch: 'arm64',
        file: (v) => assetFileName(v, 'windows', 'arm64', 'exe'),
      },
    ],
  },
  {
    id: 'macos',
    label: 'macOS',
    packages: [
      {
        label: 'Apple Silicon',
        note: 'M1 and newer',
        format: 'dmg',
        arch: 'arm64',
        file: (v) => assetFileName(v, 'macos', 'arm64', 'dmg'),
      },
      {
        label: 'Intel',
        format: 'dmg',
        arch: 'x64',
        file: (v) => assetFileName(v, 'macos', 'x64', 'dmg'),
      },
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    packages: [
      {
        label: 'AppImage',
        note: 'Runs on any distribution',
        format: 'AppImage',
        arch: 'x64',
        file: (v) => assetFileName(v, 'linux', 'x64', 'AppImage'),
      },
      {
        label: 'Debian / Ubuntu',
        format: 'deb',
        arch: 'x64',
        file: (v) => assetFileName(v, 'linux', 'x64', 'deb'),
      },
      {
        label: 'Fedora / RHEL',
        format: 'rpm',
        arch: 'x64',
        file: (v) => assetFileName(v, 'linux', 'x64', 'rpm'),
      },
    ],
  },
  {
    id: 'android',
    label: 'Android',
    packages: [
      {
        label: 'Android APK',
        note: 'Any phone, Android 7+',
        format: 'apk',
        arch: 'arm64',
        file: (v) => androidAssetFileName(v),
      },
      // No `href`: the download page renders "Soon" rather than a link, which
      // is honest. Pointing this at GitHub was worse than saying nothing.
      { label: 'Google Play', format: 'store' },
    ],
  },
  {
    id: 'ios',
    label: 'iOS',
    packages: [{ label: 'App Store', format: 'store' }],
  },
  {
    id: 'web',
    label: 'Web',
    packages: [{ label: 'Open in your browser', format: 'web', href: '/' }],
  },
];

// ── System requirements ──────────────────────────────────────────────────────

export interface SystemRequirement {
  platform: string;
  rows: { label: string; value: string }[];
}

/**
 * Published on the website and in every release note. These are starting
 * figures for a local-first Electron application and should be revised against
 * real measurements once Noto has shipped.
 */
export const SYSTEM_REQUIREMENTS: SystemRequirement[] = [
  {
    platform: 'Windows',
    rows: [
      { label: 'Operating system', value: 'Windows 10 or later' },
      { label: 'Architecture', value: 'x64 or ARM64' },
      { label: 'Memory', value: '4 GB minimum' },
      { label: 'Storage', value: '500 MB or more' },
      { label: 'Display', value: '1280 × 720 minimum' },
    ],
  },
  {
    platform: 'macOS',
    rows: [
      { label: 'Operating system', value: 'A supported modern macOS version' },
      { label: 'Architecture', value: 'Apple Silicon or Intel' },
      { label: 'Memory', value: '4 GB minimum' },
      { label: 'Storage', value: '500 MB or more' },
    ],
  },
  {
    platform: 'Linux',
    rows: [
      { label: 'Architecture', value: 'x64' },
      { label: 'Memory', value: '4 GB minimum' },
      { label: 'Storage', value: '500 MB or more' },
      { label: 'Desktop', value: 'A glibc-based distribution with a graphical session' },
    ],
  },
  {
    platform: 'Android',
    rows: [
      { label: 'Operating system', value: 'Android 7.0 (API 24) or later' },
      { label: 'Architecture', value: 'arm64-v8a, armeabi-v7a, x86 or x86_64' },
      { label: 'Storage', value: '200 MB or more' },
      {
        label: 'Installing',
        value: 'The APK is installed outside the Play Store, so Android asks you to permit it once',
      },
    ],
  },
  {
    platform: 'Web',
    rows: [
      { label: 'Browser', value: 'A current version of Chrome, Edge, Firefox or Safari' },
      { label: 'Storage', value: 'IndexedDB enabled — Noto stores documents in your browser' },
    ],
  },
];
