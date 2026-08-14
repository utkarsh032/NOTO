import { DEFAULT_SETTINGS } from '@noto/config';
import type { EditorSettings, Settings, ThemeMode } from '@noto/types';
import { create } from 'zustand';

/**
 * Application settings.
 *
 * The store deliberately knows nothing about persistence: web uses
 * localStorage, desktop a settings file, mobile AsyncStorage. Each app hydrates
 * with `replace()` at startup and subscribes to write changes back, which keeps
 * this store usable from React Native and from unit tests unchanged.
 */
export interface SettingsStore {
  settings: Settings;
  /** `true` once the platform has loaded persisted settings. */
  hydrated: boolean;

  replace(settings: Settings): void;
  setTheme(theme: ThemeMode): void;
  setAccentColor(color: string): void;
  updateEditor(patch: Partial<EditorSettings>): void;
  setSyncEnabled(enabled: boolean): void;
  reset(): void;
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  replace: (settings) => set({ settings, hydrated: true }),

  setTheme: (theme) =>
    set((state) => ({
      settings: { ...state.settings, appearance: { ...state.settings.appearance, theme } },
    })),

  setAccentColor: (accentColor) =>
    set((state) => ({
      settings: { ...state.settings, appearance: { ...state.settings.appearance, accentColor } },
    })),

  updateEditor: (patch) =>
    set((state) => ({
      settings: { ...state.settings, editor: { ...state.settings.editor, ...patch } },
    })),

  setSyncEnabled: (syncEnabled) =>
    set((state) => ({ settings: { ...state.settings, syncEnabled } })),

  reset: () => set({ settings: DEFAULT_SETTINGS }),
}));

/** Cycles light → dark → system, for the toggle-theme command. */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  switch (current) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    default:
      return 'light';
  }
}
