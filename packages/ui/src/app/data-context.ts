import type { NotoDocument, UpdateDocumentInput, Workspace } from '@noto/types';
import { createContext, useContext } from 'react';

/**
 * The seam between the shared application shell and platform storage.
 *
 * The shell renders documents but never learns where they live: web supplies a
 * Dexie-backed implementation of this value, desktop a SQLite-backed one. That
 * is what keeps Noto one application rather than one per platform.
 */
export interface NotoDataValue {
  status: 'loading' | 'ready' | 'error';
  /** Set when `status` is `'error'`. */
  error: string | null;

  workspace: Workspace | null;
  /** `undefined` while the first query is in flight. */
  documents: NotoDocument[] | undefined;
  /**
   * Soft-deleted documents, newest first. `undefined` while the first query is
   * in flight. These are the tombstones the sync layer carries to other
   * devices; Trash is simply the one place they are still visible.
   */
  trashedDocuments: NotoDocument[] | undefined;
  /**
   * The open document. `undefined` while the first query is in flight, `null`
   * when nothing is open — which is a real state now that documents are opened
   * in tabs, rather than shorthand for "show the newest one".
   */
  activeDocument: NotoDocument | null | undefined;

  selectDocument(id: string | null): void;
  /** Creates a document and returns its id, so the caller can open a tab on it. */
  createDocument(): Promise<string | null>;
  updateDocument(id: string, patch: UpdateDocumentInput): Promise<void>;
  /**
   * Soft-deletes a document. The row stays on disk as a tombstone so the sync
   * layer can remove it on other devices; it simply stops being listed.
   */
  deleteDocument(id: string): Promise<void>;
  /** Takes a document back out of Trash. */
  restoreDocument(id: string): Promise<void>;
  /**
   * Removes a document from disk for good.
   *
   * There is no tombstone left behind, so a device that has not synced since
   * may bring the document back. That is the trade every local-first
   * application makes with permanent deletion, and it is why this is only ever
   * reached through a confirmation that says so.
   */
  purgeDocument(id: string): Promise<void>;
}

export const NotoDataContext = createContext<NotoDataValue | null>(null);

export function useNotoData(): NotoDataValue {
  const value = useContext(NotoDataContext);
  if (!value) {
    throw new Error('useNotoData must be used inside a NotoDataContext provider.');
  }
  return value;
}
