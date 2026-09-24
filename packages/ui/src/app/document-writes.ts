import { updateDocument as applyUpdate } from '@noto/core';
import { type NotoDatabase, snapshotBeforeChange } from '@noto/database';
import type { UpdateDocumentInput } from '@noto/types';

import { notifyDataChanged } from './data-events';

/**
 * The one way a document edit reaches storage.
 *
 * Every platform's data source calls this, so every edit — the editor's
 * autosave, a rename, an import, a restore — passes the same version policy:
 * the text a document rested in is kept before a change replaces it.
 */
export async function writeDocumentUpdate(
  database: NotoDatabase,
  id: string,
  patch: UpdateDocumentInput,
): Promise<void> {
  const existing = await database.documents.get(id);
  if (!existing) return;

  const next = applyUpdate(existing, patch);

  if (patch.content !== undefined) {
    // A failed snapshot must not cost the edit itself.
    const kept = await snapshotBeforeChange(database, existing, next).catch(() => null);
    if (kept) notifyDataChanged('versions');
  }

  await database.documents.put(next);
}
