import { createDocument as buildDocument, updateDocument as applyUpdate } from '@noto/core';
import type { NotoDatabase } from '@noto/database';
import type { NotoDocument, UpdateDocumentInput, Workspace } from '@noto/types';
import { useCallback, useEffect, useState } from 'react';

import { openMobileDatabase } from '../platform/database';

export interface NotoStore {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  workspace: Workspace | null;
  documents: NotoDocument[];
  createDocument: () => Promise<NotoDocument | null>;
  updateDocument: (id: string, patch: UpdateDocumentInput) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads the mobile workspace and its documents.
 *
 * Reads are re-run explicitly after each write; SQLite has no change
 * subscription here, and screens are few enough that a manual refresh is
 * clearer than a synthetic observable.
 */
export function useNotoStore(): NotoStore {
  const [status, setStatus] = useState<NotoStore['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [database, setDatabase] = useState<NotoDatabase | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<NotoDocument[]>([]);

  useEffect(() => {
    let cancelled = false;

    openMobileDatabase()
      .then(async (opened) => {
        if (cancelled) return;

        const rows = await opened.database.documents.listByWorkspace(opened.workspace.id);
        if (cancelled) return;

        setDatabase(opened.database);
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

  const refresh = useCallback(async () => {
    if (!database || !workspace) return;
    setDocuments(await database.documents.listByWorkspace(workspace.id));
  }, [database, workspace]);

  const createDocument = useCallback(async () => {
    if (!database || !workspace) return null;

    const document = buildDocument({ workspaceId: workspace.id });
    await database.documents.put(document);
    setDocuments(await database.documents.listByWorkspace(workspace.id));

    return document;
  }, [database, workspace]);

  const updateDocument = useCallback(
    async (id: string, patch: UpdateDocumentInput) => {
      if (!database || !workspace) return;

      const existing = await database.documents.get(id);
      if (!existing) return;

      await database.documents.put(applyUpdate(existing, patch));
      setDocuments(await database.documents.listByWorkspace(workspace.id));
    },
    [database, workspace],
  );

  return { status, error, workspace, documents, createDocument, updateDocument, refresh };
}
