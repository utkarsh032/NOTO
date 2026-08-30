import type { Id, NotoDocument } from '@noto/types';
import { type ReactNode, useCallback, useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PromptDialog } from '../../components/PromptDialog';
import { showToast } from '../../components/toast-store';
import { ExportDialog } from '../overlays/ExportDialog';
import { useNotoData } from '../data-context';
import { printDocument } from '../print';
import { useNotoActions } from '../use-noto-actions';

export interface DocumentOperations {
  open(id: Id): void;
  rename(document: NotoDocument): void;
  duplicate(document: NotoDocument): void;
  togglePin(document: NotoDocument): void;
  archive(document: NotoDocument): void;
  exportDocument(document: NotoDocument): void;
  remove(document: NotoDocument): void;
  /** Render once per screen. Holds the rename, delete and export dialogs. */
  dialogs: ReactNode;
}

/**
 * Everything a screen can do to a document that is not editing it.
 *
 * The dialogs come with the handlers rather than being wired up per screen:
 * Home, Documents and the workspace all offer the same seven actions, and three
 * copies of a delete confirmation is three chances for them to disagree about
 * what delete means.
 *
 * Deleting is soft — the row becomes a tombstone the sync layer can carry to
 * other devices — so the confirmation says "Trash", not "permanently".
 */
export function useDocumentOperations(): DocumentOperations {
  const { createDocument, updateDocument, deleteDocument } = useNotoData();
  const actions = useNotoActions();

  const [renaming, setRenaming] = useState<NotoDocument | null>(null);
  const [deleting, setDeleting] = useState<NotoDocument | null>(null);
  const [exporting, setExporting] = useState<NotoDocument | null>(null);

  const duplicate = useCallback(
    (document: NotoDocument) => {
      void (async () => {
        const id = await createDocument();
        if (!id) return;

        await updateDocument(id, {
          title: `${document.title || 'Untitled'} copy`,
          content: document.content,
          tags: document.tags,
        });

        showToast(`Duplicated “${document.title || 'Untitled'}”`, { tone: 'success' });
      })();
    },
    [createDocument, updateDocument],
  );

  const togglePin = useCallback(
    (document: NotoDocument) => {
      void updateDocument(document.id, { isFavorite: !document.isFavorite });
    },
    [updateDocument],
  );

  const archive = useCallback(
    (document: NotoDocument) => {
      const next = document.status === 'archived' ? 'active' : 'archived';

      void updateDocument(document.id, { status: next });
      showToast(next === 'archived' ? 'Moved to archive' : 'Restored from archive');
    },
    [updateDocument],
  );

  const dialogs = (
    <>
      <PromptDialog
        open={renaming !== null}
        title="Rename document"
        label="Name"
        initialValue={renaming?.title ?? ''}
        onConfirm={(title) => {
          if (renaming) void updateDocument(renaming.id, { title });
        }}
        onClose={() => setRenaming(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Move to Trash?"
        destructive
        confirmLabel="Move to Trash"
        description={
          <>
            <p>
              “{deleting?.title || 'Untitled'}” will be moved to Trash and stop appearing in your
              documents.
            </p>
            <p className="mt-2">It stays on this device until Trash is emptied.</p>
          </>
        }
        onConfirm={() => {
          if (deleting) void deleteDocument(deleting.id);
        }}
        onClose={() => setDeleting(null)}
      />

      <ExportDialog
        open={exporting !== null}
        document={exporting}
        onClose={() => setExporting(null)}
        onPrint={() => void printDocument()}
      />
    </>
  );

  return {
    open: actions.openDocument,
    rename: setRenaming,
    duplicate,
    togglePin,
    archive,
    exportDocument: setExporting,
    remove: setDeleting,
    dialogs,
  };
}
