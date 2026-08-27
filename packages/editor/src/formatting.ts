import type { Editor } from '@tiptap/core';

import { normalizeImageSrc, normalizeLinkHref } from './urls';

/**
 * What the formatting commands in `@noto/core` actually do.
 *
 * The registry names the actions and owns their accelerators; this module is
 * the other half — the one place that knows a Noto command id maps to a Tiptap
 * chain. The toolbar, the editor keymap and, later, the desktop menu and the
 * command palette all go through here, so a button and a shortcut cannot come
 * to mean two different things.
 */

/** Alignments a heading or paragraph may take. */
export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/** Runs a command against the editor; `false` when it did not apply. */
export type EditorAction = (editor: Editor) => boolean;

/*
 * `focus()` leads every chain because half of these run from a toolbar button,
 * which takes the caret out of the document when it is clicked. Restoring it
 * first is what makes the button act on the selection the user still sees.
 */
export const EDITOR_ACTIONS: Readonly<Record<string, EditorAction>> = {
  'edit.undo': (editor) => editor.chain().focus().undo().run(),
  'edit.redo': (editor) => editor.chain().focus().redo().run(),

  'format.bold': (editor) => editor.chain().focus().toggleBold().run(),
  'format.italic': (editor) => editor.chain().focus().toggleItalic().run(),
  'format.underline': (editor) => editor.chain().focus().toggleUnderline().run(),
  'format.strike': (editor) => editor.chain().focus().toggleStrike().run(),
  'format.code': (editor) => editor.chain().focus().toggleCode().run(),

  'format.paragraph': (editor) => editor.chain().focus().setParagraph().run(),
  'format.heading1': (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  'format.heading2': (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  'format.heading3': (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),

  'format.bulletList': (editor) => editor.chain().focus().toggleBulletList().run(),
  'format.orderedList': (editor) => editor.chain().focus().toggleOrderedList().run(),
  'format.blockquote': (editor) => editor.chain().focus().toggleBlockquote().run(),
  'format.codeBlock': (editor) => editor.chain().focus().toggleCodeBlock().run(),

  /*
   * Left is an unset rather than a value: text with no alignment already reads
   * left, and writing the attribute anyway would put `textAlign: 'left'` on
   * every block a user ever straightened out.
   */
  'format.alignLeft': (editor) => editor.chain().focus().unsetTextAlign().run(),
  'format.alignCenter': (editor) => editor.chain().focus().setTextAlign('center').run(),
  'format.alignRight': (editor) => editor.chain().focus().setTextAlign('right').run(),
  'format.alignJustify': (editor) => editor.chain().focus().setTextAlign('justify').run(),

  // Marks and block type both, so one action gets the user back to plain text.
  'format.clear': (editor) => editor.chain().focus().unsetAllMarks().clearNodes().run(),

  'insert.horizontalRule': (editor) => editor.chain().focus().setHorizontalRule().run(),

  'table.addRowAfter': (editor) => editor.chain().focus().addRowAfter().run(),
  'table.addColumnAfter': (editor) => editor.chain().focus().addColumnAfter().run(),
  'table.deleteRow': (editor) => editor.chain().focus().deleteRow().run(),
  'table.deleteColumn': (editor) => editor.chain().focus().deleteColumn().run(),
  'table.toggleHeaderRow': (editor) => editor.chain().focus().toggleHeaderRow().run(),
  'table.delete': (editor) => editor.chain().focus().deleteTable().run(),
};

/**
 * Runs `commandId`, if it is one this module can complete on its own.
 *
 * Link, image and table are not: they need a URL or a size from the user first,
 * so the UI collects that and calls the functions below instead.
 */
export function runEditorAction(editor: Editor | null, commandId: string): boolean {
  if (!editor) return false;

  const action = EDITOR_ACTIONS[commandId];
  return action ? action(editor) : false;
}

/* -------------------------------------------------------------------------- */
/* Commands that need input                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Links the current selection.
 *
 * The mark is extended over the whole existing link first, so editing the URL
 * of a link the caret merely sits inside replaces it rather than splitting it
 * into two differently-targeted halves.
 */
export function applyLink(editor: Editor | null, href: string): boolean {
  if (!editor) return false;

  const url = normalizeLinkHref(href);
  if (!url) return false;

  return editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

export function removeLink(editor: Editor | null): boolean {
  if (!editor) return false;
  return editor.chain().focus().extendMarkRange('link').unsetLink().run();
}

/** The URL of the link under the caret, or `null` when there is not one. */
export function currentLinkHref(editor: Editor | null): string | null {
  if (!editor) return null;

  const href: unknown = editor.getAttributes('link').href;
  return typeof href === 'string' && href !== '' ? href : null;
}

export interface InsertImageInput {
  src: string;
  /** Describes the picture for screen readers, and for when it fails to load. */
  alt?: string;
}

export function insertImage(editor: Editor | null, { src, alt }: InsertImageInput): boolean {
  if (!editor) return false;

  const source = normalizeImageSrc(src);
  if (!source) return false;

  const trimmedAlt = alt?.trim();

  return editor
    .chain()
    .focus()
    .setImage({ src: source, alt: trimmedAlt === '' ? undefined : trimmedAlt })
    .run();
}

export interface InsertTableInput {
  rows?: number;
  cols?: number;
  withHeaderRow?: boolean;
}

export const MIN_TABLE_SIZE = 1;
export const MAX_TABLE_SIZE = 20;

const clampTableSize = (value: number): number =>
  Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, Math.round(value) || MIN_TABLE_SIZE));

export function insertTable(editor: Editor | null, input: InsertTableInput = {}): boolean {
  if (!editor) return false;

  const { rows = 3, cols = 3, withHeaderRow = true } = input;

  return editor
    .chain()
    .focus()
    .insertTable({
      // A typo in the size field should give a small table, not freeze the
      // editor building ten thousand cells.
      rows: clampTableSize(rows),
      cols: clampTableSize(cols),
      withHeaderRow,
    })
    .run();
}

/* -------------------------------------------------------------------------- */
/* Current state                                                              */
/* -------------------------------------------------------------------------- */

/** Whether `alignment` is what the current block is set to. */
function isAlignmentActive(editor: Editor, alignment: TextAlignment): boolean {
  if (editor.isActive({ textAlign: alignment })) return true;

  // Nothing carries the attribute until it is set, and unaligned text reads
  // left — so left is active precisely when nothing else is.
  if (alignment !== 'left') return false;
  return !TEXT_ALIGNMENTS.some(
    (other) => other !== 'left' && editor.isActive({ textAlign: other }),
  );
}

const ACTIVE_CHECKS: Readonly<Record<string, (editor: Editor) => boolean>> = {
  'format.bold': (editor) => editor.isActive('bold'),
  'format.italic': (editor) => editor.isActive('italic'),
  'format.underline': (editor) => editor.isActive('underline'),
  'format.strike': (editor) => editor.isActive('strike'),
  'format.code': (editor) => editor.isActive('code'),
  'format.link': (editor) => editor.isActive('link'),

  'format.paragraph': (editor) => editor.isActive('paragraph'),
  'format.heading1': (editor) => editor.isActive('heading', { level: 1 }),
  'format.heading2': (editor) => editor.isActive('heading', { level: 2 }),
  'format.heading3': (editor) => editor.isActive('heading', { level: 3 }),

  'format.bulletList': (editor) => editor.isActive('bulletList'),
  'format.orderedList': (editor) => editor.isActive('orderedList'),
  'format.blockquote': (editor) => editor.isActive('blockquote'),
  'format.codeBlock': (editor) => editor.isActive('codeBlock'),

  'format.alignLeft': (editor) => isAlignmentActive(editor, 'left'),
  'format.alignCenter': (editor) => isAlignmentActive(editor, 'center'),
  'format.alignRight': (editor) => isAlignmentActive(editor, 'right'),
  'format.alignJustify': (editor) => isAlignmentActive(editor, 'justify'),
};

/** What the toolbar needs in order to draw itself for the current selection. */
export interface EditorFormatState {
  /** Keyed by command id; `true` when the selection already has that format. */
  active: Readonly<Record<string, boolean>>;
  isEditable: boolean;
  isInTable: boolean;
  /** The link under the caret, for the link dialog to open with. */
  linkHref: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export const EMPTY_FORMAT_STATE: EditorFormatState = {
  active: {},
  isEditable: false,
  isInTable: false,
  linkHref: null,
  canUndo: false,
  canRedo: false,
};

export function readFormatState(editor: Editor | null): EditorFormatState {
  if (!editor) return EMPTY_FORMAT_STATE;

  const active: Record<string, boolean> = {};
  for (const [commandId, isActive] of Object.entries(ACTIVE_CHECKS)) {
    active[commandId] = isActive(editor);
  }

  return {
    active,
    isEditable: editor.isEditable,
    isInTable: editor.isActive('table'),
    linkHref: currentLinkHref(editor),
    // Asked of the editor rather than tracked here: ProseMirror's history is
    // the only thing that knows whether a step is left to undo.
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}
