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
  /**
   * Wrap long lines to the measure. Off lets them run, and the block scrolls
   * sideways — which is what someone pasting a wide log or a long URL wants.
   */
  wordWrap: boolean;
  /** Presentation scale for the editing canvas. 1 is 100%. */
  zoom: number;
  /**
   * Draw the characters that take up space but have no shape — spaces, tabs,
   * line breaks, paragraph ends. Off by default: it is a tool for working on
   * structured text, not a way to read a document.
   */
  showInvisibles: boolean;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  accentColor: string;
  reducedMotion: boolean;
}

export interface UpdateSettings {
  /**
   * Ask GitHub in the background whether a newer release exists.
   *
   * On by default, and the only thing in Noto that reaches the network without
   * being asked to — which is why it can be switched off. Off means Noto never
   * looks unless the user presses the button.
   */
  checkAutomatically: boolean;
  /**
   * Apply a downloaded update without asking first.
   *
   * Off by default: an update replaces the application under someone who is in
   * the middle of writing, so the default is to say a new version is ready and
   * let them choose when. On, Noto installs it the next time it starts.
   */
  automatic: boolean;
}

export interface Settings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  updates: UpdateSettings;
  /** Opt-in; Noto stays fully local until the user enables sync. */
  syncEnabled: boolean;
}
