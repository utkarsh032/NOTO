import type { Command } from './types.ts';
import { DOCUMENT_COMMANDS } from './documents.ts';
import { FILE_COMMANDS } from './files.ts';
import { TAB_COMMANDS } from './tabs.ts';
import { FORMAT_COMMANDS } from './formatting.ts';
import { HISTORY_COMMANDS } from './history.ts';
import { FIND_AND_VIEW_COMMANDS } from './find-and-view.ts';
import { CAPTURE_AND_APP_COMMANDS } from './capture-and-app.ts';

/**
 * The commands available before any feature work begins.
 *
 * Grouped in files by what they act on, and joined here in a fixed order: when
 * two commands could answer the same key, the earlier one wins.
 */
export const CORE_COMMANDS: readonly Command[] = [
  ...DOCUMENT_COMMANDS,
  ...FILE_COMMANDS,
  ...TAB_COMMANDS,
  ...FORMAT_COMMANDS,
  ...HISTORY_COMMANDS,
  ...FIND_AND_VIEW_COMMANDS,
  ...CAPTURE_AND_APP_COMMANDS,
];
