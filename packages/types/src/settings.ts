export type ThemeMode = 'light' | 'dark' | 'system';

export type EditorFontFamily = 'sans' | 'serif' | 'mono';

export interface EditorSettings {
  fontFamily: EditorFontFamily;
  fontSize: number;
  lineHeight: number;
  /** Maximum content width in pixels; `null` means full width. */
  contentWidth: number | null;
  spellCheck: boolean;
  autoSaveDelayMs: number;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: string;
  reducedMotion: boolean;
}

export interface Settings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  /** Opt-in; Noto stays fully local until the user enables sync. */
  syncEnabled: boolean;
}
