import type { Command } from './types.ts';
import { requiresDocument, requiresEditable } from './predicates.ts';

export const FIND_AND_VIEW_COMMANDS: readonly Command[] = [
  /*
   * Find and replace stay app-scoped. Their keys have to keep working while the
   * caret is in the find field — which is exactly when the editor has lost it.
   */
  {
    id: 'edit.find',
    title: 'Find',
    category: 'edit',
    shortcut: 'CmdOrCtrl+F',
    keywords: ['search'],
    isEnabled: requiresDocument,
  },
  {
    id: 'edit.replace',
    title: 'Find and Replace',
    category: 'edit',
    shortcut: 'CmdOrCtrl+H',
    keywords: ['search', 'substitute'],
    isEnabled: requiresEditable,
  },
  {
    id: 'edit.findNext',
    title: 'Find Next',
    category: 'edit',
    shortcut: 'CmdOrCtrl+G',
    isEnabled: requiresDocument,
  },
  {
    id: 'edit.findPrevious',
    title: 'Find Previous',
    category: 'edit',
    shortcut: 'CmdOrCtrl+Shift+G',
    isEnabled: requiresDocument,
  },

  {
    id: 'view.toggleSidebar',
    title: 'Toggle Sidebar',
    category: 'view',
    shortcut: 'CmdOrCtrl+\\',
  },
  {
    id: 'view.zoomIn',
    title: 'Zoom In',
    category: 'view',
    shortcut: 'CmdOrCtrl+=',
    keywords: ['larger', 'bigger'],
  },
  {
    id: 'view.zoomOut',
    title: 'Zoom Out',
    category: 'view',
    shortcut: 'CmdOrCtrl+-',
    keywords: ['smaller'],
  },
  {
    id: 'view.zoomReset',
    title: 'Reset Zoom',
    category: 'view',
    shortcut: 'CmdOrCtrl+0',
    keywords: ['actual size', '100%'],
  },
  {
    id: 'view.toggleWordWrap',
    title: 'Toggle Word Wrap',
    category: 'view',
    shortcut: 'Alt+Z',
    keywords: ['wrap', 'lines', 'overflow'],
  },
  {
    id: 'view.toggleInvisibles',
    title: 'Show Characters',
    category: 'view',
    /*
     * No accelerator. Word gives this one `Ctrl+Shift+8`, which Noto has
     * already spent on the bullet list, and the alternatives are all one
     * mistyped key away from something destructive. The toolbar carries it.
     */
    keywords: ['invisible', 'whitespace', 'formatting marks', 'pilcrow', 'spaces', 'tabs'],
  },
  {
    id: 'view.toggleTheme',
    title: 'Toggle Dark Mode',
    category: 'view',
  },
  {
    id: 'navigation.commandPalette',
    title: 'Command Palette',
    category: 'navigation',
    shortcut: 'CmdOrCtrl+K',
    aliases: ['CmdOrCtrl+Shift+P'],
    keywords: ['search', 'go to', 'jump', 'palette'],
  },

  /* The seven screens, so every one of them is reachable from the palette. */
  {
    id: 'navigation.home',
    title: 'Go to Home',
    category: 'navigation',
    keywords: ['start', 'greeting'],
  },
  {
    id: 'navigation.workspace',
    title: 'Go to Workspace',
    category: 'navigation',
    keywords: ['editor', 'writing', 'document'],
  },
  {
    id: 'navigation.documents',
    title: 'Open Documents',
    category: 'navigation',
    keywords: ['files', 'browse', 'all'],
  },
  {
    id: 'navigation.quickNotes',
    title: 'Open Quick Notes',
    category: 'navigation',
    keywords: ['jot', 'captured', 'scratch', 'notes'],
  },
  {
    id: 'navigation.memory',
    title: 'Open Noto Memory',
    category: 'navigation',
    keywords: ['captured', 'clipboard', 'screenshots'],
  },
  {
    id: 'navigation.search',
    title: 'Search Everything',
    category: 'navigation',
    shortcut: 'CmdOrCtrl+Shift+F',
    keywords: ['find', 'look up'],
  },
  {
    id: 'navigation.account',
    title: 'Account & Devices',
    category: 'navigation',
    keywords: ['profile', 'devices', 'sessions'],
  },
  {
    id: 'navigation.plans',
    title: 'Plans & Pricing',
    category: 'navigation',
    keywords: ['plan', 'pricing', 'upgrade', 'pro', 'billing', 'compare'],
  },
  {
    id: 'navigation.signIn',
    title: 'Sign In',
    category: 'navigation',
    keywords: ['login', 'account', 'sync', 'sign out'],
  },
];
