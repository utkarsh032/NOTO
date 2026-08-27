import { RECENT_DOCUMENTS_LIMIT } from '@noto/config';
import type { Id, TabsState } from '@noto/types';
import { create } from 'zustand';

/**
 * Which documents are open, in what order, and which one is in front.
 *
 * The store holds ids, never documents: the database is the only thing that
 * knows what a document contains, and a tab whose document has been deleted
 * should disappear rather than render a stale copy. `prune` is what enforces
 * that once the document list is known.
 *
 * Dirty state lives here too, so a tab can show that its document has unsaved
 * work without the tab bar having to reach into whichever editor happens to be
 * mounted. Only the active document is ever mounted, so nothing else could
 * report it.
 *
 * Persistence is the platform's job, the same arrangement the settings store
 * uses: `replace()` at startup, and a subscription that writes changes back.
 */
export interface TabsStore extends TabsState {
  /** Document ids with edits not yet written to storage. */
  dirtyIds: Id[];
  /** `true` once the platform has loaded the persisted tabs. */
  hydrated: boolean;

  replace(state: TabsState): void;

  /** Opens `id` in a tab if it is not already open, and brings it to the front. */
  open(id: Id): void;
  /** Brings an already-open tab to the front. Opens it if it is not. */
  activate(id: Id): void;
  /**
   * Closes one tab. The neighbour to the right takes over, or the one to the
   * left when the closed tab was last — which is what every editor does, and
   * what keeps the eye where it already was.
   */
  close(id: Id): void;
  closeAll(): void;
  /** Drops tabs whose documents no longer exist. */
  prune(existingIds: readonly Id[]): void;

  setDirty(id: Id, dirty: boolean): void;
  clearDirty(): void;
}

export const EMPTY_TABS_STATE: TabsState = { openIds: [], activeId: null, recentIds: [] };

/** Most recent first, no duplicates, capped. */
function remember(recentIds: readonly Id[], id: Id): Id[] {
  return [id, ...recentIds.filter((existing) => existing !== id)].slice(0, RECENT_DOCUMENTS_LIMIT);
}

/** Which tab should take over when `id` is closed. */
function neighbourOf(openIds: readonly Id[], id: Id): Id | null {
  const index = openIds.indexOf(id);
  if (index === -1) return null;

  return openIds[index + 1] ?? openIds[index - 1] ?? null;
}

export const useTabsStore = create<TabsStore>()((set) => ({
  ...EMPTY_TABS_STATE,
  dirtyIds: [],
  hydrated: false,

  replace: (state) =>
    set({
      openIds: [...state.openIds],
      // A persisted active id that is not in the open list would render a tab
      // bar with nothing selected.
      activeId: state.activeId && state.openIds.includes(state.activeId) ? state.activeId : null,
      recentIds: [...state.recentIds],
      hydrated: true,
    }),

  open: (id) =>
    set((state) => ({
      openIds: state.openIds.includes(id) ? state.openIds : [...state.openIds, id],
      activeId: id,
      recentIds: remember(state.recentIds, id),
    })),

  activate: (id) =>
    set((state) => ({
      openIds: state.openIds.includes(id) ? state.openIds : [...state.openIds, id],
      activeId: id,
      recentIds: remember(state.recentIds, id),
    })),

  close: (id) =>
    set((state) => {
      if (!state.openIds.includes(id)) return state;

      const successor = state.activeId === id ? neighbourOf(state.openIds, id) : state.activeId;

      return {
        openIds: state.openIds.filter((open) => open !== id),
        activeId: successor,
        // The tab is gone but the document is not, so it stays in recents —
        // closing something is how it becomes recent rather than open.
        dirtyIds: state.dirtyIds.filter((dirty) => dirty !== id),
      };
    }),

  closeAll: () => set({ openIds: [], activeId: null, dirtyIds: [] }),

  prune: (existingIds) =>
    set((state) => {
      const exists = new Set(existingIds);

      const openIds = state.openIds.filter((id) => exists.has(id));
      const recentIds = state.recentIds.filter((id) => exists.has(id));
      const dirtyIds = state.dirtyIds.filter((id) => exists.has(id));

      /*
       * Every list is checked, not just the open one: a document that was
       * closed and then deleted is gone from `openIds` already, and testing
       * only that would leave its id in recents for good.
       */
      const unchanged =
        openIds.length === state.openIds.length &&
        recentIds.length === state.recentIds.length &&
        dirtyIds.length === state.dirtyIds.length;

      // Returning the same arrays keeps subscribers still.
      if (unchanged) return state;

      return {
        openIds,
        recentIds,
        dirtyIds,
        activeId:
          state.activeId && exists.has(state.activeId) ? state.activeId : (openIds[0] ?? null),
      };
    }),

  setDirty: (id, dirty) =>
    set((state) => {
      const isDirty = state.dirtyIds.includes(id);
      if (isDirty === dirty) return state;

      return {
        dirtyIds: dirty ? [...state.dirtyIds, id] : state.dirtyIds.filter((open) => open !== id),
      };
    }),

  clearDirty: () => set({ dirtyIds: [] }),
}));

/** The persisted slice, for the platform's storage layer to write. */
export function toPersistedTabs(state: TabsStore): TabsState {
  return { openIds: state.openIds, activeId: state.activeId, recentIds: state.recentIds };
}
