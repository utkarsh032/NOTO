/** The shape of a command, and where its accelerator is bound. */

export type CommandCategory = 'file' | 'edit' | 'format' | 'insert' | 'view' | 'navigation' | 'app';

export interface CommandContext {
  hasActiveDocument: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  /** True when the caret sits inside a table cell. Optional: most callers never enter one. */
  isInTable?: boolean;
}

/**
 * Who owns a command's accelerator.
 *
 * `editor` keys are bound inside ProseMirror by `@noto/editor`, because they
 * act on the document and must not fire while the caret is somewhere else.
 * `app` keys are bound on the window. The distinction is load-bearing: binding
 * one key in both places runs the command twice, which for a toggle means
 * turning it on and straight back off.
 */
export type CommandScope = 'app' | 'editor';

export interface Command {
  id: string;
  title: string;
  category: CommandCategory;
  /** Defaults to `'app'` when omitted. */
  scope?: CommandScope;
  /**
   * Accelerator in Electron/CodeMirror notation. `CmdOrCtrl` is resolved to the
   * platform modifier at display time.
   */
  shortcut?: string;
  /**
   * Further accelerators that fire the same command.
   *
   * `shortcut` is the one shown in menus and hints; these are the keys other
   * applications have taught people to reach for. The command palette answers
   * to both `CmdOrCtrl+K` and `CmdOrCtrl+Shift+P` for exactly that reason.
   */
  aliases?: string[];
  keywords?: string[];
  /** Defaults to always available when omitted. */
  isEnabled?: (context: CommandContext) => boolean;
}

/** Where a command's accelerator is bound; `app` unless it says otherwise. */
export function scopeOf(command: Command): CommandScope {
  return command.scope ?? 'app';
}
