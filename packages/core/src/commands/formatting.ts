import type { Command } from './types.ts';
import { requiresEditable, requiresTable } from './predicates.ts';

export const FORMAT_COMMANDS: readonly Command[] = [
  /*
   * Formatting.
   *
   * The accelerators below are the editor's keymap, not a second copy of it:
   * `@noto/editor` builds ProseMirror's bindings from these entries, so a
   * shortcut changed here changes what the editor actually does.
   *
   * Where an accelerator matches Tiptap's own default it is repeated
   * deliberately — the registry has to state it for menus and the command
   * palette to render, and stating it is what keeps the two in step.
   */
  {
    id: 'format.bold',
    title: 'Bold',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+B',
    keywords: ['strong', 'weight'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.italic',
    title: 'Italic',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+I',
    keywords: ['emphasis', 'oblique'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.underline',
    title: 'Underline',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+U',
    isEnabled: requiresEditable,
  },
  {
    id: 'format.strike',
    title: 'Strikethrough',
    category: 'format',
    scope: 'editor',
    /*
     * Not `CmdOrCtrl+Shift+S`, which Save As now owns — the key means Save As
     * in every application that has a file menu, and somebody reaching for it
     * over an open document is reaching to save it. This is the binding Google
     * Docs, Notion and Slack use for strikethrough.
     */
    shortcut: 'CmdOrCtrl+Shift+X',
    keywords: ['strikethrough', 'cross out'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.code',
    title: 'Inline Code',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+E',
    keywords: ['monospace'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.link',
    title: 'Link',
    category: 'format',
    scope: 'editor',
    /*
     * Not `CmdOrCtrl+K`, which the command palette already owns. Link is the
     * more common binding elsewhere, but the palette is reachable from every
     * screen and formatting is not, so the palette keeps the shorter key.
     */
    shortcut: 'CmdOrCtrl+Shift+K',
    keywords: ['url', 'hyperlink', 'anchor'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.paragraph',
    title: 'Paragraph',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Alt+0',
    keywords: ['body', 'normal text'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading1',
    title: 'Heading 1',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Alt+1',
    keywords: ['title', 'h1'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading2',
    title: 'Heading 2',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Alt+2',
    keywords: ['subtitle', 'h2'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading3',
    title: 'Heading 3',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Alt+3',
    keywords: ['h3'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.bulletList',
    title: 'Bullet List',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+8',
    keywords: ['unordered', 'bullets', 'points'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.orderedList',
    title: 'Numbered List',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+7',
    keywords: ['ordered', 'numbers'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.taskList',
    title: 'Checklist',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+9',
    keywords: ['task', 'todo', 'checkbox', 'tick'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.blockquote',
    title: 'Blockquote',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+B',
    keywords: ['quote', 'citation'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.codeBlock',
    title: 'Code Block',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Alt+C',
    keywords: ['snippet', 'fenced', 'monospace'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignLeft',
    title: 'Align Left',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+L',
    keywords: ['alignment'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignCenter',
    title: 'Align Center',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+E',
    keywords: ['alignment', 'centre'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignRight',
    title: 'Align Right',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+R',
    keywords: ['alignment'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignJustify',
    title: 'Justify',
    category: 'format',
    scope: 'editor',
    shortcut: 'CmdOrCtrl+Shift+J',
    keywords: ['alignment', 'justified'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.clear',
    title: 'Clear Formatting',
    category: 'format',
    scope: 'editor',
    keywords: ['remove', 'plain', 'reset'],
    isEnabled: requiresEditable,
  },

  /* Insertions. */
  {
    id: 'insert.image',
    title: 'Insert Image',
    category: 'insert',
    scope: 'editor',
    keywords: ['picture', 'photo', 'figure'],
    isEnabled: requiresEditable,
  },
  {
    id: 'insert.horizontalRule',
    title: 'Insert Divider',
    category: 'insert',
    scope: 'editor',
    keywords: ['horizontal rule', 'separator', 'line'],
    isEnabled: requiresEditable,
  },
  {
    id: 'insert.table',
    title: 'Insert Table',
    category: 'insert',
    scope: 'editor',
    keywords: ['grid', 'rows', 'columns'],
    isEnabled: requiresEditable,
  },
  {
    id: 'table.addRowAfter',
    title: 'Insert Row Below',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
  {
    id: 'table.addColumnAfter',
    title: 'Insert Column After',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
  {
    id: 'table.deleteRow',
    title: 'Delete Row',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
  {
    id: 'table.deleteColumn',
    title: 'Delete Column',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
  {
    id: 'table.toggleHeaderRow',
    title: 'Toggle Header Row',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
  {
    id: 'table.delete',
    title: 'Delete Table',
    category: 'insert',
    scope: 'editor',
    isEnabled: requiresTable,
  },
];
