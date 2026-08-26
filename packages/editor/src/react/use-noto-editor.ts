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
    autofocus,
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current?.(fromEditorContent(instance.getJSON()));
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

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
