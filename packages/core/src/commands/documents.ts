import type { Command } from './types.ts';

export const DOCUMENT_COMMANDS: readonly Command[] = [
  {
    id: 'document.new',
    title: 'New Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+N',
    keywords: ['create', 'note', 'page'],
  },
  {
    id: 'folder.new',
    title: 'New Folder',
    category: 'file',
    shortcut: 'CmdOrCtrl+Shift+N',
  },
];
