/**
 * The human-written changelog.
 *
 * This is the summarised view: one entry per released version, in the words of
 * whoever cut the release. The `/releases` page shows the full notes published
 * on GitHub, fetched live. Add an entry here as part of preparing a release —
 * `docs/releases/README.md` describes where it fits in the process.
 */

export type ChangeKind = 'added' | 'improved' | 'fixed' | 'changed' | 'removed';

export interface ChangelogEntry {
  version: string;
  /** ISO date, or null while the version is still unreleased. */
  date: string | null;
  /** One sentence describing what this release is about. */
  summary: string;
  changes: { kind: ChangeKind; description: string }[];
}

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  added: 'Added',
  improved: 'Improved',
  fixed: 'Fixed',
  changed: 'Changed',
  removed: 'Removed',
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.6',
    date: '2026-08-26',
    summary: 'Noto for Android, published on the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'An Android application for phones running Android 7.0 or later, published on the download page as a 16 MB APK — 64-bit, with a separate build for older 32-bit phones, signed with Noto’s own upload key. Documents are stored on the device, as on every other platform.',
      },
    ],
  },
  {
    version: '1.1.5',
    date: '2026-08-25',
    summary: 'The Android APK, published on the download page at last.',
    changes: [
      {
        kind: 'added',
        description:
          'The Android APK is published on the download page — a 16 MB 64-bit build, with a separate one for older 32-bit phones, signed with Noto’s own upload key.',
      },
      {
        kind: 'fixed',
        description:
          'Publishing waits for the mobile build instead of running as soon as the desktop packages are ready. The APK was being built correctly and then arriving too late to be attached, which is why 1.1.3 and 1.1.4 shipped without it.',
      },
      {
        kind: 'fixed',
        description:
          'Generating the native Android project no longer removes packages the rest of the build depends on, which had been hanging that step until the job timed out.',
      },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-08-25',
    summary: 'The Android APK, signed with a real upload key and published on the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'The Android APK is published on the download page — a 16 MB 64-bit build, with a separate one for older 32-bit phones. 1.1.3 shipped without it because the signing key was missing, and the pipeline correctly refused to publish an APK carrying the shared Android debug key.',
      },
    ],
  },
  // 1.1.2 has no entry because it has no release. It was tagged, its packaging
  // run was cancelled by a hung build, and nothing was ever published under it
  // — so listing it here would advertise a version with nothing to download.
  // Everything it promised ships in 1.1.3.
  {
    version: '1.1.3',
    date: '2026-08-25',
    summary: 'Noto for Android, published as an APK you can install from the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'An Android application for phones running Android 7.0 or later, published on the download page as a 16 MB APK — 64-bit, with a separate build for older 32-bit phones. Documents are stored on the device, as on every other platform.',
      },
      {
        kind: 'fixed',
        description:
          'Android release builds are signed with a real upload key. The pipeline had been passing one through and nothing was reading it, so builds were signed with the shared Android debug key instead.',
      },
      {
        kind: 'fixed',
        description:
          'The download page only links files a release actually carries, rather than offering every platform for every version and occasionally pointing at a file that was never published.',
      },
      {
        kind: 'fixed',
        description:
          'A build that stops responding no longer costs a release. Packaging attempts are given a deadline and retried, and a genuinely broken build now fails loudly instead of being reported as cancelled. This is what stopped 1.1.2 from being published.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-15',
    summary: 'The first published release of Noto.',
    changes: [
      {
        kind: 'added',
        description:
          'Desktop applications for Windows, macOS and Linux, with automatic updates on Windows and macOS.',
      },
      {
        kind: 'added',
        description:
          'A web application that runs in the browser with nothing to install, and keeps working offline once loaded.',
      },
      {
        kind: 'added',
        description:
          'Local-first storage on every platform — SQLite on the desktop, IndexedDB in the browser. No account and no telemetry.',
      },
      {
        kind: 'added',
        description:
          'A rich text editor built on ProseMirror: headings, lists, quotes, code blocks and inline formatting, with autosave.',
      },
      {
        kind: 'added',
        description:
          'This website, with download, documentation and release pages, and a download page that resolves the latest release live.',
      },
      {
        kind: 'added',
        description:
          'The build and release pipeline: continuous integration, packaged installers for every desktop platform, and tag-driven GitHub Releases with checksums.',
      },
    ],
  },
];

/** True until the first version has actually been published. */
export const HAS_RELEASES = CHANGELOG.some((entry) => entry.date !== null);
