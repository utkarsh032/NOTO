import type { Settings } from '@noto/types';

import { AUTOSAVE_DELAY_MS, DEFAULT_ZOOM } from './app.ts';
import {
  DEFAULT_CUSTOM_MARGINS,
  DEFAULT_MARGIN_PRESET,
  DEFAULT_PAGE_ORIENTATION,
  DEFAULT_PAGE_SIZE,
} from './page.ts';
import { brand, layout } from './tokens.ts';

/**
 * The settings a fresh Noto install starts from.
 *
 * Sync is off until opted into, and so is automatic updating: Noto will say
 * when a new version is ready, but replacing the application is the user's
 * call to make.
 */
export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: 'system',
    accentColor: brand[600],
    reducedMotion: false,
  },
  editor: {
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.6,
    contentWidth: layout.editorMaxWidth,
    spellCheck: true,
    autoSaveDelayMs: AUTOSAVE_DELAY_MS,
    wordWrap: true,
    zoom: DEFAULT_ZOOM,
    showInvisibles: false,
    /*
     * A new document is a text file, not a sheet of paper. Somebody opening
     * Noto to write something down should get a blank page they can type on,
     * the width of the window — page size and margins are for the document
     * that is going to be printed, and that user goes and asks for them.
     */
    pageMode: 'simple',
    pageSize: DEFAULT_PAGE_SIZE,
    pageOrientation: DEFAULT_PAGE_ORIENTATION,
    marginPreset: DEFAULT_MARGIN_PRESET,
    customMargins: DEFAULT_CUSTOM_MARGINS,
  },
  updates: {
    checkAutomatically: true,
    automatic: false,
  },
  syncEnabled: false,
};
