import { STORAGE_KEYS } from '@noto/config';
import { EMPTY_TABS_STATE, toPersistedTabs, useTabsStore } from '@noto/core';
import type { TabsState } from '@noto/types';

/**
 * Persists which documents are open to the WebView's localStorage — the same
 * arrangement the settings use, and for the same reason.
 *
 * Ids only: the documents themselves come back from SQLite across the bridge,
 * and a tab whose document has since gone is dropped when the list loads.
 */

function isIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function readTabs(): TabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tabs);
    if (!raw) return EMPTY_TABS_STATE;

    const parsed = JSON.parse(raw) as Partial<TabsState>;

    // Validated rather than trusted: a malformed tab list would otherwise take
    // the whole workspace down on launch.
    return {
      openIds: isIdArray(parsed.openIds) ? parsed.openIds : [],
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      recentIds: isIdArray(parsed.recentIds) ? parsed.recentIds : [],
    };
  } catch {
    return EMPTY_TABS_STATE;
  }
}

function writeTabs(state: TabsState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.tabs, JSON.stringify(state));
  } catch {
    // A full or blocked quota costs the session restore, not the session.
  }
}

/** Hydrates the tab store and keeps localStorage in step with it. */
export function initTabsPersistence(): () => void {
  useTabsStore.getState().replace(readTabs());

  return useTabsStore.subscribe((state) => {
    writeTabs(toPersistedTabs(state));
  });
}
