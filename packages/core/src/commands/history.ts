import type { Command } from './types.ts';
import { requiresEditable } from './predicates.ts';

export const HISTORY_COMMANDS: readonly Command[] = [
  /*
   * Editing history. Bound inside the editor rather than on the window: undo
   * belongs to whatever holds the caret, and ProseMirror already owns the keys.
   */
  {
    id: 'edit.undo',
    title: 'Undo',
    category: 'edit',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Z',
    isEnabled: requiresEditable,
  },
  {
    id: 'edit.redo',
    title: 'Redo',
    category: 'edit',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+Z',
    isEnabled: requiresEditable,
  },
];
