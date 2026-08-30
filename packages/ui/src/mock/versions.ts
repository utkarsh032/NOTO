import type { DocumentVersion } from '@noto/types';

/**
 * Presentation data for version history.
 *
 * Noto keeps one recovery snapshot per document today, not a version log, so
 * the panel is built against this fixture. Restoring from it is deliberately
 * not wired to storage: an action that says it restored a version and did
 * nothing would be worse than one that is plainly not finished yet.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = Date.now();
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

export function buildVersions(documentId: string, currentWordCount: number): DocumentVersion[] {
  return [
    {
      id: `${documentId}-v6`,
      documentId,
      createdAt: ago(2 * MINUTE),
      author: 'You',
      wordCount: currentWordCount,
      isCurrent: true,
      summary: 'Current version',
    },
    {
      id: `${documentId}-v5`,
      documentId,
      createdAt: ago(3 * HOUR),
      author: 'Autosave',
      wordCount: Math.max(0, currentWordCount - 42),
      isCurrent: false,
      summary: 'Added the Phase 3 section',
    },
    {
      id: `${documentId}-v4`,
      documentId,
      createdAt: ago(7 * HOUR),
      author: 'Autosave',
      wordCount: Math.max(0, currentWordCount - 118),
      isCurrent: false,
      summary: 'Reworked the overview',
    },
    {
      id: `${documentId}-v3`,
      documentId,
      createdAt: ago(DAY + 2 * HOUR),
      author: 'You',
      wordCount: Math.max(0, currentWordCount - 210),
      isCurrent: false,
      summary: 'Split the phases into subsections',
    },
    {
      id: `${documentId}-v2`,
      documentId,
      createdAt: ago(3 * DAY),
      author: 'Autosave',
      wordCount: Math.max(0, currentWordCount - 320),
      isCurrent: false,
      summary: null,
    },
    {
      id: `${documentId}-v1`,
      documentId,
      createdAt: ago(6 * DAY),
      author: 'You',
      wordCount: 12,
      isCurrent: false,
      summary: 'Created',
    },
  ];
}
