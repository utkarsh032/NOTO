import type { Entity, Id, IsoDateTime } from './common';

/**
 * What Noto Memory holds.
 *
 * One entity with a kind rather than six tables: everything captured is
 * searched together, listed together and pinned the same way, and the only
 * thing that differs between a clipboard entry and a screenshot is how the card
 * previews it.
 */
export type MemoryKind = 'note' | 'clipboard' | 'screenshot' | 'image' | 'link' | 'file';

export interface MemoryItem extends Entity {
  workspaceId: Id;
  kind: MemoryKind;
  /** A short heading. Derived from the content when the capture had no title. */
  title: string;
  /** Plain-text body, or the transcript/description of a captured asset. */
  content: string;
  /** Where it came from: an application name, a hostname, a device. */
  source: string | null;
  /** Absolute or object URL for `image`, `screenshot` and `file` kinds. */
  url: string | null;
  tags: string[];
  isPinned: boolean;
  /** Size on disk in bytes, for captured assets. `null` for text. */
  sizeBytes: number | null;
}

/** A snapshot of a document, as offered by version history. */
export interface DocumentVersion {
  id: Id;
  documentId: Id;
  createdAt: IsoDateTime;
  /** Who or what made it: a person's name, or "Autosave". */
  author: string;
  /** Words in the document at this version, for the size delta shown in the list. */
  wordCount: number;
  /** `true` for the version currently in the editor. */
  isCurrent: boolean;
  /** A one-line description of what changed, when Noto can tell. */
  summary: string | null;
}
