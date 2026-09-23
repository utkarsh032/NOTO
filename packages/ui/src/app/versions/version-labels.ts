import type { DocumentVersionRecord } from '@noto/types';

/** What a version is called in the list, by where it came from. */
export function versionOriginLabel(version: DocumentVersionRecord): string {
  switch (version.origin) {
    case 'manual':
      return 'Saved';
    case 'restore':
      return 'Before a restore';
    case 'conflict':
      return 'Kept after a conflict';
    case 'import':
      return 'Imported';
    default:
      return 'Autosave';
  }
}
