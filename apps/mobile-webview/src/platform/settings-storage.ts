import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@noto/config';
import { useSettingsStore } from '@noto/core';
import type { Settings } from '@noto/types';

/**
 * Persists settings to the WebView's localStorage, which Android keeps in the
 * application's private data directory and clears only when the app is
 * uninstalled or its data is cleared.
 *
 * Documents live in SQLite on the native side; this is only preferences, so
 * losing it costs a theme choice rather than a note. That is deliberate — it is
 * also why nothing here is written across the bridge.
 */

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<Settings>;

    // Merged rather than used as-is, so settings added in a later release get
    // their defaults instead of arriving as undefined.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
      editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
      updates: { ...DEFAULT_SETTINGS.updates, ...parsed.updates },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // A full or blocked storage quota must not take the editor down.
  }
}

/** Hydrates the settings store and keeps localStorage in step with it. */
export function initSettingsPersistence(): () => void {
  useSettingsStore.getState().replace(readSettings());

  return useSettingsStore.subscribe((state) => {
    writeSettings(state.settings);
  });
}
