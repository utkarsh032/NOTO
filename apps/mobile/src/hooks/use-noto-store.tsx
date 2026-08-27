import {
  createDocument as buildDocument,
  deleteDocument as applyDelete,
  updateDocument as applyUpdate,
} from '@noto/core';
import type { NotoDatabase } from '@noto/database';
import type { NotoDocument, UpdateDocumentInput, Workspace } from '@noto/types';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { openMobileDatabase } from '../platform/database';

export interface NotoStore {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  workspace: Workspace | null;
  documents: NotoDocument[];
  createDocument: () => Promise<NotoDocument | null>;
  updateDocument: (id: string, patch: UpdateDocumentInput) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotoStoreContext = createContext<NotoStore | null>(null);

/**
 * Loads the mobile workspace and its documents.
 *
 * Reads are re-run explicitly after each write; SQLite has no change
 * subscription here, and screens are few enough that a manual refresh is
 * clearer than a synthetic observable.
 *
 * The connection and the workspace live in a ref rather than in state so every
 * mutator keeps a stable identity. The editor debounces saves against these
 * callbacks and flushes on unmount — a callback that changed identity mid-edit
 * would restart that timer and drop the pending write.
 */
function useNotoStoreValue(): NotoStore {
  const [status, setStatus] = useState<NotoStore['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<NotoDocument[]>([]);

  const openedRef = useRef<{ database: NotoDatabase; workspace: Workspace } | null>(null);

  const refresh = useCallback(async () => {
    const opened = openedRef.current;
    if (!opened) return;

    setDocuments(await opened.database.documents.listByWorkspace(opened.workspace.id));
  }, []);

  useEffect(() => {
    let cancelled = false;

    openMobileDatabase()
      .then(async (opened) => {
        if (cancelled) return;
        openedRef.current = opened;

        const rows = await opened.database.documents.listByWorkspace(opened.workspace.id);
        if (cancelled) return;

        setWorkspace(opened.workspace);
        setDocuments(rows);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Local storage is unavailable.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const createDocument = useCallback(async () => {
    const opened = openedRef.current;
    if (!opened) return null;

    const document = buildDocument({ workspaceId: opened.workspace.id });
    await opened.database.documents.put(document);
    await refresh();

    return document;
  }, [refresh]);

  const updateDocument = useCallback(
    async (id: string, patch: UpdateDocumentInput) => {
      const opened = openedRef.current;
      if (!opened) return;

      const existing = await opened.database.documents.get(id);
      if (!existing) return;

      await opened.database.documents.put(applyUpdate(existing, patch));
      await refresh();
    },
    [refresh],
  );

  /**
   * Soft-deletes a document, the same way web and desktop do: the tombstone is
   * what tells the sync layer to remove the row on other devices, and
   * `listByWorkspace` already hides it from the list.
   */
  const deleteDocument = useCallback(
    async (id: string) => {
      const opened = openedRef.current;
      if (!opened) return;

      const existing = await opened.database.documents.get(id);
      if (!existing) return;

      await opened.database.documents.put(applyDelete(existing));
      await refresh();
    },
    [refresh],
  );

  return useMemo(
    () => ({
      status,
      error,
      workspace,
      documents,
      createDocument,
      updateDocument,
      deleteDocument,
      refresh,
    }),
    [status, error, workspace, documents, createDocument, updateDocument, deleteDocument, refresh],
  );
}

/**
 * Holds the one store the whole application reads.
 *
 * Every screen used to call `useNotoStore()` directly, which gave each of them
 * its own copy of the document list: a title typed in the editor was written to
 * SQLite but the list screen kept rendering the rows it had loaded at mount.
 * Sharing one value through context is what keeps the two in step.
 */
export function NotoStoreProvider({ children }: { children: ReactNode }) {
  const store = useNotoStoreValue();

  return <NotoStoreContext.Provider value={store}>{children}</NotoStoreContext.Provider>;
}

export function useNotoStore(): NotoStore {
  const store = useContext(NotoStoreContext);
  if (!store) throw new Error('useNotoStore must be used inside <NotoStoreProvider>.');

  return store;
}
