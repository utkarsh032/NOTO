import type { Settings } from '@noto/types';

import { AUTOSAVE_DELAY_MS } from './app';
import { brand, layout } from './tokens';

/** The settings a fresh Noto install starts from. Sync is off until opted into. */
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
  },
  syncEnabled: false,
};
