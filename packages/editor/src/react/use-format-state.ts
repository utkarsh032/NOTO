import { type Editor, useEditorState } from '@tiptap/react';

import { EMPTY_FORMAT_STATE, type EditorFormatState, readFormatState } from '../formatting';

/**
 * Subscribes to what the current selection is formatted as.
 *
 * `useEditorState` recomputes on every transaction but only re-renders when the
 * snapshot actually differs, so a toolbar built on this redraws when the caret
 * moves into bold text — not on every keystroke inside it.
 */
export function useFormatState(editor: Editor | null): EditorFormatState {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => readFormatState(instance),
  });

  return state ?? EMPTY_FORMAT_STATE;
}
