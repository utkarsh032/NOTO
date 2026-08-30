import type { Id } from '@noto/types';
import { useCallback, useMemo } from 'react';

import type { WritingTemplate } from '../mock/templates';
import type { ImportedDocument } from './export';
import { navigate } from './router';
import { useNotoData } from './data-context';
import { useDocumentTabs } from './use-document-tabs';

export interface NotoActions {
  /** Opens a document in a tab and moves to the workspace. */
  openDocument(id: Id): void;
  /** Creates an empty document, opens it, and goes to the workspace. */
  newDocument(): Promise<void>;
  /** Creates a document pre-filled from a Start Writing template. */
  newFromTemplate(template: WritingTemplate): Promise<void>;
  /**
   * Writes an imported file into a new document, without opening it.
   *
   * Importing ten files should leave you looking at the list you imported them
   * into, not at the tenth one.
   */
  importDocument(imported: ImportedDocument): Promise<void>;
}

/**
 * The four things every screen needs to do with a document.
 *
 * Opening a document is two facts — it is in a tab now, and the workspace is
 * what you are looking at — and every screen that lists documents needs both.
 * Keeping them together here is what stops Home, Documents and the command
 * palette from each having their own idea of what "open" means.
 */
export function useNotoActions(): NotoActions {
  const { createDocument, updateDocument } = useNotoData();
  const tabs = useDocumentTabs();

  const openDocument = useCallback(
    (id: Id) => {
      tabs.open(id);
      navigate({ name: 'workspace', param: id });
    },
    [tabs],
  );

  const newDocument = useCallback(async () => {
    const id = await createDocument();
    if (id) openDocument(id);
  }, [createDocument, openDocument]);

  const newFromTemplate = useCallback(
    async (template: WritingTemplate) => {
      const id = await createDocument();
      if (!id) return;

      /*
       * The template is written through the same update path a keystroke takes,
       * so a templated document is an ordinary document from the moment it
       * exists — there is no second kind of record to migrate later.
       */
      const { title, content } = template.build();
      await updateDocument(id, { title, content });

      openDocument(id);
    },
    [createDocument, updateDocument, openDocument],
  );

  const importDocument = useCallback(
    async (imported: ImportedDocument) => {
      const id = await createDocument();
      if (!id) return;

      await updateDocument(id, { title: imported.title, content: imported.content });
    },
    [createDocument, updateDocument],
  );

  return useMemo(
    () => ({ openDocument, newDocument, newFromTemplate, importDocument }),
    [openDocument, newDocument, newFromTemplate, importDocument],
  );
}
