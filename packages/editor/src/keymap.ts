import { CORE_COMMANDS, toKeymapBinding } from '@noto/core';
import { type Editor, Extension } from '@tiptap/core';

import { FORMAT_ACTIONS } from './formatting';

/**
 * Handles a formatting command the editor cannot finish on its own — the link
 * key, which needs a URL. Returns `true` once handled.
 */
export type InteractiveCommandHandler = (commandId: string) => boolean;

export interface NotoKeymapStorage {
  onInteractiveCommand?: InteractiveCommandHandler;
}

declare module '@tiptap/core' {
  interface Storage {
    notoKeymap: NotoKeymapStorage;
  }
}

/** Categories whose accelerators belong to the editor rather than the shell. */
const EDITOR_CATEGORIES = new Set(['format', 'insert']);

/**
 * Binds the formatting accelerators from the command registry.
 *
 * Tiptap ships defaults for most of these already, and several of the registry
 * entries deliberately match them. Registering them here anyway is the point:
 * this extension loads after StarterKit, so its bindings win, and the registry
 * — not a table buried inside a third-party package — decides which key does
 * what. Change `CmdOrCtrl+Shift+7` in `@noto/core` and the editor follows.
 *
 * These are the editor's own keys, bound through ProseMirror rather than the
 * window-level listener in `useCommandShortcuts`, so exactly one handler exists
 * per accelerator. Binding formatting in both places would toggle a mark on and
 * straight back off again.
 */
export const NotoKeymap = Extension.create({
  name: 'notoKeymap',

  /*
   * The handler for commands that need input lives in storage rather than in
   * options: the keymap is built once, when the editor is created, but the UI
   * that answers those prompts re-renders constantly. Storage is a box the
   * caller can drop a new handler into without rebuilding the editor.
   */
  addStorage(): NotoKeymapStorage {
    return { onInteractiveCommand: undefined };
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {};

    for (const command of CORE_COMMANDS) {
      if (!command.shortcut) continue;
      if (!EDITOR_CATEGORIES.has(command.category)) continue;

      const binding = toKeymapBinding(command.shortcut);
      if (!binding) continue;

      const action = FORMAT_ACTIONS[command.id];

      shortcuts[binding] = () => {
        if (action) return action(this.editor);

        // Returning false leaves the keystroke to whatever would otherwise
        // have had it, rather than swallowing it.
        return this.editor.storage.notoKeymap.onInteractiveCommand?.(command.id) ?? false;
      };
    }

    return shortcuts;
  },
});

/**
 * Tells the editor who answers the commands that need input from the user.
 *
 * Call it from an effect: the handler is per-editor mutable state, not part of
 * the document or the schema.
 */
export function setInteractiveCommandHandler(
  editor: Editor | null,
  handler: InteractiveCommandHandler | undefined,
): void {
  // `undefined` while the editor is still being created, and absent entirely
  // if something built an editor without this extension.
  const storage: NotoKeymapStorage | undefined = editor?.storage.notoKeymap;
  if (storage) storage.onInteractiveCommand = handler;
}
