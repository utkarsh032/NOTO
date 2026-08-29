import { EDITOR_SCROLL_MARGIN } from '@noto/config';
import type { DocumentContent } from '@noto/types';
import { type Editor, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

import { fromEditorContent, toEditorContent } from '../content';
import { type NotoExtensionOptions, createNotoExtensions } from '../extensions';
import { type InteractiveCommandHandler, setInteractiveCommandHandler } from '../keymap';

export interface UseNotoEditorOptions {
  /** Initial content. Later changes are pushed in only when they did not come from this editor. */
  content: DocumentContent;
  editable?: boolean;
  autofocus?: boolean;
  onChange?: (content: DocumentContent) => void;
  /**
   * Handles a formatting accelerator the editor cannot complete on its own —
   * the link key, which needs a URL. Return `true` once handled.
   */
  onInteractiveCommand?: InteractiveCommandHandler;
  extensionOptions?: NotoExtensionOptions;
}

/**
 * Creates the Noto editor instance.
 *
 * Callbacks are held in refs so that a caller re-creating them on every render
 * — the normal case — does not tear down and rebuild the editor, which would
 * lose the cursor position on each keystroke.
 */
export function useNotoEditor({
  content,
  editable = true,
  autofocus = false,
  onChange,
  onInteractiveCommand,
  extensionOptions,
}: UseNotoEditorOptions): Editor | null {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: createNotoExtensions(extensionOptions),
    content: toEditorContent(content),
    editable,
    /*
     * Focus is taken below rather than here. Tiptap's own autofocus scrolls the
     * caret into view, which on a document being reopened fights the pane's
     * attempt to restore where the reader was and drags them back to the top.
     */
    autofocus: false,

    /*
     * Keeping the caret clear of the edges of the scroller.
     *
     * ProseMirror scrolls the caret into view itself, and left alone it stops
     * as soon as the caret is technically visible — which puts it underneath
     * the sticky toolbar at the top of the same scroll container, and flush
     * against the rim at the bottom. `scrollThreshold` is how close the caret
     * may come before the editor scrolls; `scrollMargin` is how much room it
     * leaves once it does. They have to agree, or the editor scrolls on every
     * keystroke inside the gap between them.
     */
    editorProps: {
      scrollThreshold: {
        top: EDITOR_SCROLL_MARGIN,
        bottom: EDITOR_SCROLL_MARGIN,
        left: 0,
        right: 0,
      },
      scrollMargin: { top: EDITOR_SCROLL_MARGIN, bottom: EDITOR_SCROLL_MARGIN, left: 0, right: 0 },
    },

    onUpdate: ({ editor: instance }) => {
      onChangeRef.current?.(fromEditorContent(instance.getJSON()));
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  /*
   * Autofocus, without the scroll.
   *
   * `focus` and "put the caret where the eye is" are two requests, and only
   * the first one is wanted when a document opens: the caret starts at the top
   * of the document, which is not necessarily where the reader left off.
   */
  useEffect(() => {
    if (!editor || !autofocus) return;
    editor.commands.focus('start', { scrollIntoView: false });
  }, [editor, autofocus]);

  /*
   * The keymap is built once, when the editor is created, so it reaches the
   * current handler through the editor rather than closing over whichever one
   * existed at that moment.
   */
  useEffect(() => {
    setInteractiveCommandHandler(editor, onInteractiveCommand);
  }, [editor, onInteractiveCommand]);

  return editor;
}
