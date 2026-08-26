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
  activeDocument: NotoDocument | null | undefined;

  selectDocument(id: string | null): void;
  createDocument(): Promise<void>;
  updateDocument(id: string, patch: UpdateDocumentInput): Promise<void>;
  /**
   * Soft-deletes a document. The row stays on disk as a tombstone so the sync
   * layer can remove it on other devices; it simply stops being listed.
   */
  deleteDocument(id: string): Promise<void>;
}

export const NotoDataContext = createContext<NotoDataValue | null>(null);

export function useNotoData(): NotoDataValue {
  const value = useContext(NotoDataContext);
  if (!value) {
    throw new Error('useNotoData must be used inside a NotoDataContext provider.');
  }
  return value;
}
