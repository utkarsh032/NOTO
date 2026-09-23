import { STORAGE_KEYS } from '@noto/config';
import { EMPTY_TABS_STATE, parsePersistedTabs, toPersistedTabs, useTabsStore } from '@noto/core';
import type { TabsState } from '@noto/types';

/**
 * Persists which documents are open to the renderer's localStorage, which
 * Electron keeps in the application's user-data directory.
 *
 * Ids only: the documents themselves come back from SQLite, and a tab whose
 * document has since gone is dropped when the list loads.
 */

function readTabs(): TabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tabs);
    return raw ? parsePersistedTabs(JSON.parse(raw)) : EMPTY_TABS_STATE;
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
