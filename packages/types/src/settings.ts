export type ThemeMode = 'light' | 'dark' | 'system';

export type EditorFontFamily = 'sans' | 'serif' | 'mono';

/**
 * Whether the document is drawn as a plain sheet of text or as paper.
 *
 * `simple` is what Noto opens with: no page, no margins, text starting at the
 * left edge of the window and running as wide as the window allows — a text
 * file, the way Notepad shows one. `page` is the opposite choice, made
 * deliberately: a sheet of a chosen size with margins around it, for a document
 * that is going to be printed and needs to be seen the way it will come out.
 */
export type PageLayoutMode = 'simple' | 'page';

export type PageSizeId = 'a4' | 'letter' | 'legal';

/**
 * Which way round the paper goes.
 *
 * A page size names a sheet, not the way it is held: Letter turned on its side
 * is still Letter. Keeping the two apart is what lets somebody print a wide
 * table without having to find a paper size that happens to be short and fat.
 */
export type PageOrientation = 'portrait' | 'landscape';

export type MarginPresetId = 'normal' | 'narrow' | 'moderate' | 'wide' | 'office2003' | 'custom';

/** Page margins, in inches, the way every word processor states them. */
export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

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
  /**
   * Paper, or no paper. `simple` by default, so a new document is a blank text
   * file rather than a page with a size and margins to think about.
   */
  pageMode: PageLayoutMode;
  /** The sheet the page mode draws, and prints onto. */
  pageSize: PageSizeId;
  /** Which way round that sheet is. */
  pageOrientation: PageOrientation;
  /** Which named set of margins the page uses; `custom` reads `customMargins`. */
  marginPreset: MarginPresetId;
  /** The margins behind the `custom` preset, in inches. */
  customMargins: PageMargins;
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
