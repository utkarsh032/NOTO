import {
  createDocument as buildDocument,
  deleteDocument as applyDelete,
  restoreDocument as applyRestore,
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

  /*
   * `undefined` until the workspace is known, not `[]`. An empty array here
   * would mean "this workspace has no documents", and the tab bar would take it
   * at its word and close every tab it had just restored.
   */
  const documents = useLiveQuery(
    async () => (workspaceId ? db.documents.listByWorkspace(workspaceId) : undefined),
    [workspaceId],
  );

  /*
   * Trash: the same live query with the tombstones left in. Kept separate from
   * `documents` so that nothing which lists documents has to remember to
   * exclude the deleted ones.
   */
  const trashedDocuments = useLiveQuery(async () => {
    if (!workspaceId) return undefined;

    const rows = await db.documents.listByWorkspace(workspaceId, { includeDeleted: true });
    return rows.filter((row) => row.deletedAt !== null);
  }, [workspaceId]);

  const createDocument = useCallback(async () => {
    if (!workspaceId) return null;

    const document = buildDocument({ workspaceId });
    await db.documents.put(document);
    setSelectedId(document.id);

    return document.id;
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

    // Stop pointing at a tombstone. The tab bar notices the document has gone,
    // drops its tab and moves to a neighbour.
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const restoreDocument = useCallback(async (id: string) => {
    const existing = await db.documents.get(id);
    if (!existing) return;

    await db.documents.put(applyRestore(existing));
  }, []);

  const purgeDocument = useCallback(async (id: string) => {
    await db.documents.purge(id);
  }, []);

  /*
   * `undefined` means "not resolved yet", and is deliberately distinct from
   * `null`: a document that was just created is briefly absent from the live
   * query result, and resolving that window to "nothing open" would close the
   * tab the editor is about to render.
   *
   * There is no fallback to the newest row. Which document is open is the tab
   * bar's business, and a silent fallback here would make closing the last tab
   * impossible — it would reopen something immediately.
   */
  const activeDocument = useMemo(() => {
    if (documents === undefined) return undefined;
    if (selectedId === null) return null;

    return documents.find((row) => row.id === selectedId);
  }, [selectedId, documents]);

  return useMemo(
    () => ({
      status,
      error,
      workspace,
      documents,
      trashedDocuments,
      activeDocument,
      selectDocument: setSelectedId,
      createDocument,
      updateDocument,
      deleteDocument,
      restoreDocument,
      purgeDocument,
    }),
    [
      status,
      error,
      workspace,
      documents,
      trashedDocuments,
      activeDocument,
      createDocument,
      updateDocument,
      deleteDocument,
      restoreDocument,
      purgeDocument,
    ],
  );
}
