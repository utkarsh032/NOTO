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
export interface TabsStore extends Required<TabsState> {
  /** Document ids with edits not yet written to storage. */
  dirtyIds: Id[];
  /** `true` once the platform has loaded the persisted tabs. */
  hydrated: boolean;

  replace(state: TabsState): void;

  /**
   * Opens `id` in a tab if it is not already open, and brings it to the front.
   * `after` puts a new tab straight after that one — a duplicate sits next to
   * its original rather than at the far end of the row.
   */
  open(id: Id, options?: { after?: Id }): void;
  /** Brings an already-open tab to the front. Opens it if it is not. */
  activate(id: Id): void;
  /**
   * Closes one tab. The neighbour to the right takes over, or the one to the
   * left when the closed tab was last — which is what every editor does, and
   * what keeps the eye where it already was.
   */
  close(id: Id): void;
  /** Closes every tab that is not pinned. */
  closeAll(): void;
  /** Pins an open tab to the front of the row, or unpins it. */
  togglePin(id: Id): void;
  /** Moves a tab one place left (-1) or right (+1), within its group. */
  moveBy(id: Id, delta: -1 | 1): void;
  /** Reopens the most recently closed tab. Returns its id, or `null`. */
  reopenClosed(): Id | null;
  /** Drops tabs whose documents no longer exist. */
  prune(existingIds: readonly Id[]): void;

  setDirty(id: Id, dirty: boolean): void;
  clearDirty(): void;
}

export const EMPTY_TABS_STATE: Required<TabsState> = {
  openIds: [],
  activeId: null,
  recentIds: [],
  pinnedIds: [],
  closedIds: [],
};

/** How many closed tabs Reopen remembers. */
const CLOSED_TABS_LIMIT = 20;

/** Pinned first, in pinned order; then everything else, in its own order. */
function ordered(openIds: readonly Id[], pinnedIds: readonly Id[]): Id[] {
  const pinned = pinnedIds.filter((id) => openIds.includes(id));
  return [...pinned, ...openIds.filter((id) => !pinned.includes(id))];
}

function rememberClosed(closedIds: readonly Id[], ids: readonly Id[]): Id[] {
  const closing = [...ids].reverse();
  return [...closing, ...closedIds.filter((id) => !ids.includes(id))].slice(0, CLOSED_TABS_LIMIT);
}

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

export const useTabsStore = create<TabsStore>()((set, get) => ({
  ...EMPTY_TABS_STATE,
  dirtyIds: [],
  hydrated: false,

  replace: (state) => {
    const pinnedIds = (state.pinnedIds ?? []).filter((id) => state.openIds.includes(id));

    set({
      openIds: ordered(state.openIds, pinnedIds),
      // A persisted active id that is not in the open list would render a tab
      // bar with nothing selected.
      activeId: state.activeId && state.openIds.includes(state.activeId) ? state.activeId : null,
      recentIds: [...state.recentIds],
      pinnedIds,
      closedIds: [...(state.closedIds ?? [])],
      hydrated: true,
    });
  },

  open: (id, options) =>
    set((state) => {
      let openIds = state.openIds;

      if (!openIds.includes(id)) {
        const afterIndex = options?.after === undefined ? -1 : openIds.indexOf(options.after);
        openIds =
          afterIndex === -1
            ? [...openIds, id]
            : [...openIds.slice(0, afterIndex + 1), id, ...openIds.slice(afterIndex + 1)];
      }

      return {
        openIds: ordered(openIds, state.pinnedIds),
        activeId: id,
        recentIds: remember(state.recentIds, id),
        closedIds: state.closedIds.filter((closed) => closed !== id),
      };
    }),

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
        pinnedIds: state.pinnedIds.filter((pinned) => pinned !== id),
        closedIds: rememberClosed(state.closedIds, [id]),
      };
    }),

  /*
   * Pinned tabs stay: pinning is how somebody says "keep this open", and
   * Close All is the command most likely to be pressed without looking.
   */
  closeAll: () =>
    set((state) => {
      const closing = state.openIds.filter((id) => !state.pinnedIds.includes(id));
      const kept = state.openIds.filter((id) => state.pinnedIds.includes(id));

      return {
        openIds: kept,
        activeId:
          state.activeId && kept.includes(state.activeId) ? state.activeId : (kept[0] ?? null),
        dirtyIds: state.dirtyIds.filter((id) => kept.includes(id)),
        closedIds: rememberClosed(state.closedIds, closing),
      };
    }),

  togglePin: (id) =>
    set((state) => {
      if (!state.openIds.includes(id)) return state;

      const pinnedIds = state.pinnedIds.includes(id)
        ? state.pinnedIds.filter((pinned) => pinned !== id)
        : [...state.pinnedIds, id];

      return { pinnedIds, openIds: ordered(state.openIds, pinnedIds) };
    }),

  moveBy: (id, delta) =>
    set((state) => {
      const index = state.openIds.indexOf(id);
      const target = index + delta;
      const neighbour = state.openIds[target];
      if (index === -1 || neighbour === undefined) return state;

      // A tab does not cross the line between pinned and unpinned.
      if (state.pinnedIds.includes(id) !== state.pinnedIds.includes(neighbour)) return state;

      const openIds = [...state.openIds];
      openIds[index] = neighbour;
      openIds[target] = id;

      const pinnedIds = state.pinnedIds.includes(id)
        ? openIds.filter((open) => state.pinnedIds.includes(open))
        : state.pinnedIds;

      return { openIds, pinnedIds };
    }),

  reopenClosed: () => {
    const [id] = get().closedIds;
    if (id === undefined) return null;

    get().open(id);
    return id;
  },

  prune: (existingIds) =>
    set((state) => {
      const exists = new Set(existingIds);

      const openIds = state.openIds.filter((id) => exists.has(id));
      const recentIds = state.recentIds.filter((id) => exists.has(id));
      const dirtyIds = state.dirtyIds.filter((id) => exists.has(id));
      const pinnedIds = state.pinnedIds.filter((id) => exists.has(id));
      const closedIds = state.closedIds.filter((id) => exists.has(id));

      /*
       * Every list is checked, not just the open one: a document that was
       * closed and then deleted is gone from `openIds` already, and testing
       * only that would leave its id in recents for good.
       */
      const unchanged =
        openIds.length === state.openIds.length &&
        recentIds.length === state.recentIds.length &&
        dirtyIds.length === state.dirtyIds.length &&
        pinnedIds.length === state.pinnedIds.length &&
        closedIds.length === state.closedIds.length;

      // Returning the same arrays keeps subscribers still.
      if (unchanged) return state;

      return {
        openIds,
        recentIds,
        dirtyIds,
        pinnedIds,
        closedIds,
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
  return {
    openIds: state.openIds,
    activeId: state.activeId,
    recentIds: state.recentIds,
    pinnedIds: state.pinnedIds,
    closedIds: state.closedIds,
  };
}

function isIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Reads persisted tabs, validated rather than trusted: a malformed tab list —
 * hand-edited, or written by a release that no longer exists — would
 * otherwise take the whole workspace down on launch.
 */
export function parsePersistedTabs(value: unknown): TabsState {
  if (!value || typeof value !== 'object') return EMPTY_TABS_STATE;
  const parsed = value as Partial<Record<keyof TabsState, unknown>>;

  return {
    openIds: isIdArray(parsed.openIds) ? parsed.openIds : [],
    activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    recentIds: isIdArray(parsed.recentIds) ? parsed.recentIds : [],
    pinnedIds: isIdArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
    closedIds: isIdArray(parsed.closedIds) ? parsed.closedIds : [],
  };
}
