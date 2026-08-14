import type { DocumentContent } from '@noto/types';
import { type Editor, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

import { fromEditorContent, toEditorContent } from '../content';
import { type NotoExtensionOptions, createNotoExtensions } from '../extensions';

export interface UseNotoEditorOptions {
  /** Initial content. Later changes are pushed in only when they did not come from this editor. */
  content: DocumentContent;
  editable?: boolean;
  autofocus?: boolean;
  onChange?: (content: DocumentContent) => void;
  extensionOptions?: NotoExtensionOptions;
}

/**
 * Creates the Noto editor instance.
 *
 * `onChange` is held in a ref so that a caller re-creating the callback on every
 * render — the normal case — does not tear down and rebuild the editor, which
 * would lose the cursor position on each keystroke.
 */
export function useNotoEditor({
  content,
  editable = true,
  autofocus = false,
  onChange,
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

  return editor;
}
