import type { DocumentVersionRecord } from '@noto/types';
import { useEffect, useState } from 'react';

import { useDataRevision } from '../data-events';
import { useNotoData } from '../data-context';

export interface DocumentVersions {
  /** Newest first. Empty while loading. */
  versions: DocumentVersionRecord[];
  loading: boolean;
}

/** The kept versions of one document, re-read whenever any window keeps another. */
export function useDocumentVersions(documentId: string): DocumentVersions {
  const { database } = useNotoData();
  const revision = useDataRevision('versions');
  const [state, setState] = useState<{ id: string; versions: DocumentVersionRecord[] } | null>(
    null,
  );

  useEffect(() => {
    if (!database) return;

    let cancelled = false;
    void database.versions.listByDocument(documentId).then((versions) => {
      if (!cancelled) setState({ id: documentId, versions });
    });

    return () => {
      cancelled = true;
    };
  }, [database, documentId, revision]);

  // A list belonging to the previous document is not this one's.
  const current = state?.id === documentId ? state.versions : null;

  return { versions: current ?? [], loading: current === null };
}
