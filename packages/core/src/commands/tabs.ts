import type { Command } from './types.ts';
import { requiresDocument } from './predicates.ts';

export const TAB_COMMANDS: readonly Command[] = [
  /*
   * Tabs.
   *
   * Reopen and the two moves carry the accelerators desktop editors use. A
   * browser keeps some of them for its own tabs — Chrome will not hand
   * Ctrl+Shift+T to a page — so on the web these are reached from the tab's
   * menu and the palette, and the keys work in the desktop application.
   */
  {
    id: 'tab.togglePin',
    title: 'Pin or Unpin Tab',
    category: 'view',
    keywords: ['tab', 'pin', 'keep', 'sticky'],
    isEnabled: requiresDocument,
  },
  {
    id: 'tab.duplicate',
    title: 'Duplicate Document',
    category: 'file',
    keywords: ['tab', 'copy', 'clone'],
    isEnabled: requiresDocument,
  },
  {
    id: 'tab.moveLeft',
    title: 'Move Tab Left',
    category: 'view',
    shortcut: 'CmdOrCtrl+Shift+PageUp',
    keywords: ['tab', 'reorder'],
    isEnabled: requiresDocument,
  },
  {
    id: 'tab.moveRight',
    title: 'Move Tab Right',
    category: 'view',
    shortcut: 'CmdOrCtrl+Shift+PageDown',
    keywords: ['tab', 'reorder'],
    isEnabled: requiresDocument,
  },
  {
    id: 'tab.reopenClosed',
    title: 'Reopen Closed Tab',
    category: 'view',
    shortcut: 'CmdOrCtrl+Shift+T',
    keywords: ['tab', 'restore', 'undo close'],
  },
];
