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
   * into, not at the tenth one. The id comes back so a caller that does want
   * to open it — or to remember which file on disk it came from — can.
   */
  importDocument(imported: ImportedDocument): Promise<Id | null>;
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
  const { createDocument } = useNotoData();
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
      // Created whole: an editor that mounts on it must see the template.
      const { title, content } = template.build();
      const id = await createDocument({ title, content });
      if (!id) return;

      openDocument(id);
    },
    [createDocument, openDocument],
  );

  const importDocument = useCallback(
    async (imported: ImportedDocument) => {
      return createDocument({ title: imported.title, content: imported.content });
    },
    [createDocument],
  );

  return useMemo(
    () => ({ openDocument, newDocument, newFromTemplate, importDocument }),
    [openDocument, newDocument, newFromTemplate, importDocument],
  );
}
