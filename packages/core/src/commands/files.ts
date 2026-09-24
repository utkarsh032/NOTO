import type { Command } from './types.ts';
import { requiresDocument } from './predicates.ts';

export const FILE_COMMANDS: readonly Command[] = [
  /*
   * Files on the user's own disk.
   *
   * These three are Notepad's, deliberately and down to the keys. A workspace
   * is a good place to keep a thousand notes and a bad place to keep the one
   * file somebody has to hand to a colleague, and a notes application that can
   * only ever save inside itself is a place work goes into rather than through.
   *
   * So Save means what it means everywhere else: write this document to a file.
   * A document that already has one is written straight to it; a document that
   * has none is asked where to go, once, and remembers the answer. Save As
   * always asks. Open reads a file from disk into a tab, and what is typed
   * there afterwards goes back to the same file.
   *
   * None of it replaces autosave. The workspace copy is still written on its
   * own timer and flushed by every one of these, so the file on disk is a
   * second home for the document rather than the only one.
   */
  {
    id: 'document.open',
    title: 'Open File…',
    category: 'file',
    shortcut: 'CmdOrCtrl+O',
    keywords: ['file', 'disk', 'import', 'browse', 'load'],
  },
  {
    id: 'document.save',
    title: 'Save Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+S',
    keywords: ['file', 'disk', 'write'],
    isEnabled: requiresDocument,
  },
  {
    id: 'document.saveAs',
    title: 'Save Document As…',
    category: 'file',
    shortcut: 'CmdOrCtrl+Shift+S',
    keywords: ['save as', 'file', 'disk', 'copy', 'elsewhere'],
    isEnabled: requiresDocument,
  },
  {
    id: 'document.archive',
    title: 'Archive Document',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.delete',
    title: 'Move Document to Trash',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.toggleFavorite',
    title: 'Toggle Favorite',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.rename',
    title: 'Rename Document',
    category: 'file',
    shortcut: 'F2',
    keywords: ['title', 'name'],
    isEnabled: requiresDocument,
  },
  {
    id: 'document.saveAll',
    title: 'Save All',
    category: 'file',
    shortcut: 'CmdOrCtrl+Alt+S',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.print',
    title: 'Print Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+P',
    keywords: ['pdf', 'paper', 'export'],
    isEnabled: requiresDocument,
  },
  {
    id: 'document.close',
    title: 'Close Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+W',
    keywords: ['tab'],
    isEnabled: requiresDocument,
  },
  {
    id: 'document.closeAll',
    title: 'Close All Documents',
    category: 'file',
    shortcut: 'CmdOrCtrl+Shift+W',
    keywords: ['tabs'],
    isEnabled: requiresDocument,
  },
];
