import {
  createDocument as buildDocument,
  deleteDocument as applyDelete,
  updateDocument as applyUpdate,
} from '@noto/core';
import type { UpdateDocumentInput, Workspace } from '@noto/types';
import type { NotoDataValue } from '@noto/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db, ensureWorkspace } from './database';

/**
 * The web application's data source.
 *
 * It uses Dexie's live queries rather than the generic polling hook, so writes
 * from anywhere — including another browser tab editing the same workspace —
 * refresh the UI without an explicit invalidation step.
 */
export function useWebNotoData(): NotoDataValue {
  const [status, setStatus] = useState<NotoDataValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    ensureWorkspace()
      .then((opened) => {
        if (cancelled) return;
        setWorkspace(opened);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'IndexedDB is unavailable.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const workspaceId = workspace?.id ?? null;

  const documents = useLiveQuery(
    async () => (workspaceId ? db.documents.listByWorkspace(workspaceId) : []),
    [workspaceId],
  );

  const createDocument = useCallback(async () => {
    if (!workspaceId) return;

    const document = buildDocument({ workspaceId });
    await db.documents.put(document);
    setSelectedId(document.id);
  }, [workspaceId]);

  const updateDocument = useCallback(async (id: string, patch: UpdateDocumentInput) => {
    const existing = await db.documents.get(id);
    if (!existing) return;

    await db.documents.put(applyUpdate(existing, patch));
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const existing = await db.documents.get(id);
    if (!existing) return;

    await db.documents.put(applyDelete(existing));

    // Drop the selection when the open document is the one that went away, so
    // the shell falls back to the newest remaining document rather than
    // pointing at a tombstone.
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  /*
   * Derived rather than stored, so opening the most recent document needs no
   * selection effect.
   *
   * `undefined` means "not resolved yet". A document that was just created is
   * briefly absent from the live query result, and falling back to the newest
   * row in that window would quietly point the editor at a different document —
   * sending the user's next keystrokes to the wrong note.
   */
  const activeDocument = useMemo(() => {
    if (documents === undefined) return undefined;
    if (selectedId === null) return documents[0] ?? null;

    return documents.find((row) => row.id === selectedId);
  }, [selectedId, documents]);

  return useMemo(
    () => ({
      status,
      error,
      workspace,
      documents,
      activeDocument,
      selectDocument: setSelectedId,
      createDocument,
      updateDocument,
      deleteDocument,
    }),
    [
      status,
      error,
      workspace,
      documents,
      activeDocument,
      createDocument,
      updateDocument,
      deleteDocument,
    ],
  );
}
