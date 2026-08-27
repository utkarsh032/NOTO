import { type Editor, useEditorState } from '@tiptap/react';

import { EMPTY_FORMAT_STATE, type EditorFormatState, readFormatState } from '../formatting';
import { EMPTY_SEARCH_STATUS, type SearchStatus, readSearchStatus } from '../search';

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

/**
 * Subscribes to the find query and how many matches it has.
 *
 * Separate from the format state so that typing in the document re-counts
 * matches without also re-rendering every toolbar button, and so a document
 * with no find bar open pays nothing for it.
 */
export function useSearchStatus(editor: Editor | null): SearchStatus {
  const status = useEditorState({
    editor,
    selector: ({ editor: instance }) => readSearchStatus(instance),
  });

  return status ?? EMPTY_SEARCH_STATUS;
}
