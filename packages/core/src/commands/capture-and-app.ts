import type { Command } from './types.ts';

export const CAPTURE_AND_APP_COMMANDS: readonly Command[] = [
  /*
   * Capture surfaces. These are global accelerators on the desktop — the point
   * of a quick note is that it opens from wherever you are — so they stay on
   * modifier combinations no editor binding uses.
   */
  {
    id: 'app.quickNote',
    title: 'Quick Note',
    category: 'app',
    shortcut: 'CmdOrCtrl+Alt+N',
    keywords: ['jot', 'scratch', 'capture', 'floating'],
  },
  {
    id: 'app.quickPaste',
    title: 'Quick Paste',
    category: 'app',
    shortcut: 'CmdOrCtrl+Alt+V',
    keywords: ['clipboard', 'history', 'paste'],
  },
  {
    id: 'app.floatingNoto',
    title: 'Floating Noto',
    category: 'app',
    keywords: ['mini', 'window', 'overlay'],
  },
  {
    id: 'app.smartSidebar',
    title: 'Smart Sidebar',
    category: 'app',
    keywords: ['rail', 'edge', 'overlay'],
  },
  {
    id: 'app.toggleDock',
    title: 'Toggle Quick Note Dock',
    category: 'app',
    shortcut: 'CmdOrCtrl+Alt+D',
    keywords: ['dock', 'edge', 'handle', 'always on top', 'pin'],
  },
  {
    id: 'app.aiAssistant',
    title: 'Noto AI',
    category: 'app',
    keywords: ['ai', 'assistant', 'ask', 'rewrite'],
  },
  {
    id: 'app.shortcuts',
    title: 'Keyboard Shortcuts',
    category: 'app',
    shortcut: 'CmdOrCtrl+/',
    keywords: ['keys', 'accelerators', 'help'],
  },
  {
    id: 'app.settings',
    title: 'Settings',
    category: 'app',
    shortcut: 'CmdOrCtrl+,',
  },
  {
    id: 'app.checkForUpdates',
    title: 'Check for Updates',
    category: 'app',
    keywords: ['update', 'upgrade', 'version', 'release', 'new'],
  },
];
