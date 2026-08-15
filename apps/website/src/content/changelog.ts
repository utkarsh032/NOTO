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
