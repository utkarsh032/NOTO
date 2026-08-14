import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@noto/config';
import { useSettingsStore } from '@noto/core';
import type { Settings } from '@noto/types';

/**
 * Persists settings to the renderer's localStorage, which Electron keeps in the
 * app's user-data directory. Documents live in SQLite; this is only preferences.
 */

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<Settings>;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
      editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function initSettingsPersistence(): () => void {
  useSettingsStore.getState().replace(readSettings());

  return useSettingsStore.subscribe((state) => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    } catch {
      // Storage failures must not take the editor down.
    }
  });
}
