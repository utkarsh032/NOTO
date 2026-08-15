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
    version: 'Unreleased',
    date: null,
    summary: 'Work towards the first public release.',
    changes: [
      {
        kind: 'added',
        description:
          'The monorepo foundation: shared packages for the editor, storage, design system and domain types.',
      },
      {
        kind: 'added',
        description: 'Web, desktop and mobile applications built on that shared core.',
      },
      {
        kind: 'added',
        description:
          'The build and release pipeline: continuous integration, packaged desktop installers, and tag-driven GitHub Releases.',
      },
      {
        kind: 'added',
        description: 'This website, with download, documentation and release pages.',
      },
    ],
  },
];

/** True until the first version has actually been published. */
export const HAS_RELEASES = CHANGELOG.some((entry) => entry.date !== null);
