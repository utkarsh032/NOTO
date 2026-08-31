import type { Settings } from '@noto/types';

import { AUTOSAVE_DELAY_MS, DEFAULT_ZOOM } from './app';
import { brand, layout } from './tokens';

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
  },
  updates: {
    checkAutomatically: true,
    automatic: false,
  },
  syncEnabled: false,
};
