import type { NotoDatabase } from '@noto/database';
import { useEffect } from 'react';

import { persistQuickNoteDraftTo } from './quick-note-draft';

/**
 * Mirrors the Quick Note draft into `database` while mounted. Every window that
 * can write the draft calls this — the application and the desktop dock — so
 * whichever of them was typed into keeps the durable copy current.
 */
export function usePersistQuickNoteDraft(database: NotoDatabase | null): void {
  useEffect(() => (database ? persistQuickNoteDraftTo(database) : undefined), [database]);
}
