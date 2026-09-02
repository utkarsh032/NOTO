import type { Id } from './common.ts';

/**
 * Which documents are open in the workspace, and which one is in front.
 *
 * This is the persisted shape: it survives a restart, so reopening Noto puts
 * back the desk the user left rather than a single arbitrary document. It holds
 * ids only — the documents themselves come from the database, so a tab for a
 * document that has since been deleted simply resolves to nothing and is
 * dropped.
 */
export interface TabsState {
  /** Open documents, in the order their tabs are shown. */
  openIds: Id[];
  /** The tab in front. `null` when nothing is open. */
  activeId: Id | null;
  /** Most recently opened first, whether or not still open. */
  recentIds: Id[];
}
