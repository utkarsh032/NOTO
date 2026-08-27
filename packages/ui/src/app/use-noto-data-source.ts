import {
  createDocument as buildDocument,
  deleteDocument as applyDelete,
  updateDocument as applyUpdate,
} from '@noto/core';
import type { NotoDatabase } from '@noto/database';
import type { NotoDocument, UpdateDocumentInput, Workspace } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NotoDataValue } from './data-context';

export interface NotoDataSourceOptions {
  /**
   * Opens storage and returns the workspace to show, creating it if needed.
   * Must be referentially stable — wrap it in `useCallback`.
   */
  open: () => Promise<{ database: NotoDatabase; workspace: Workspace }>;
}

/**
 * Builds a `NotoDataValue` from any `NotoDatabase`.
 *
 * Reads are re-run whenever a write completes, tracked by a local revision
 * counter. That is deliberately simple: it is correct for a single window, and
 * platforms that can do better (Dexie's live queries, SQLite change hooks) can
 * supply their own value instead of using this hook.
 */
export function useNotoDataSource({ open }: NotoDataSourceOptions): NotoDataValue {
  const [status, setStatus] = useState<NotoDataValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<NotoDocument[] | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const databaseRef = useRef<NotoDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;

    open()
      .then(({ database, workspace: opened }) => {
        if (cancelled) return;
        databaseRef.current = database;
        setWorkspace(opened);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Blocked storage and private-browsing modes land here; surface the
        // reason rather than leaving the user on a spinner.
        setError(cause instanceof Error ? cause.message : 'Local storage is unavailable.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const database = databaseRef.current;
    if (!database || !workspace) return;

    let cancelled = false;

    void database.documents.listByWorkspace(workspace.id).then((rows) => {
      if (!cancelled) setDocuments(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [workspace, revision]);

  const createDocument = useCallback(async () => {
    const database = databaseRef.current;
    if (!database || !workspace) return null;

    const document = buildDocument({ workspaceId: workspace.id });
    await database.documents.put(document);

    setSelectedId(document.id);
    setRevision((value) => value + 1);

    return document.id;
  }, [workspace]);

  const updateDocument = useCallback(async (id: string, patch: UpdateDocumentInput) => {
    const database = databaseRef.current;
    if (!database) return;

    const existing = await database.documents.get(id);
    if (!existing) return;

    await database.documents.put(applyUpdate(existing, patch));
    setRevision((value) => value + 1);
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const database = databaseRef.current;
    if (!database) return;

    const existing = await database.documents.get(id);
    if (!existing) return;

    await database.documents.put(applyDelete(existing));

    // Stop pointing at a tombstone. The tab bar notices the document has gone,
    // drops its tab and moves to a neighbour.
    setSelectedId((current) => (current === id ? null : current));
    setRevision((value) => value + 1);
  }, []);

  /*
   * `undefined` means "not resolved yet", and is deliberately distinct from
   * `null`: a document that was just created is briefly absent from
   * `documents`, and resolving that window to "nothing open" would close the
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
