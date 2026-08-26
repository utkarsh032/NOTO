import { useCallback, useMemo, useState } from 'react';

/** The formatting commands that need something from the user before they run. */
export type FormattingPromptKind = 'link' | 'image' | 'table';

const PROMPT_FOR_COMMAND: Readonly<Record<string, FormattingPromptKind>> = {
  'format.link': 'link',
  'insert.image': 'image',
  'insert.table': 'table',
};

export interface FormattingPrompts {
  /** The prompt currently open, or `null`. Only one is ever open at a time. */
  open: FormattingPromptKind | null;
  openPrompt: (kind: FormattingPromptKind) => void;
  closePrompt: () => void;
  /** Toggles a prompt: pressing the same control twice puts it away again. */
  togglePrompt: (kind: FormattingPromptKind) => void;
  /**
   * Opens the prompt that completes `commandId`, and reports whether there was
   * one. This is what the editor keymap calls, so ⌘⇧K and the link button end
   * up in the same place.
   */
  handleCommand: (commandId: string) => boolean;
}

/**
 * Holds which formatting prompt is showing.
 *
 * Lifted out of the toolbar because two things open these: the toolbar buttons,
 * and the accelerators bound inside the editor. Keeping the state here lets
 * both reach it without the editor having to know a toolbar exists.
 */
export function useFormattingPrompts(): FormattingPrompts {
  const [open, setOpen] = useState<FormattingPromptKind | null>(null);

  const openPrompt = useCallback((kind: FormattingPromptKind) => setOpen(kind), []);
  const closePrompt = useCallback(() => setOpen(null), []);
  const togglePrompt = useCallback(
    (kind: FormattingPromptKind) => setOpen((current) => (current === kind ? null : kind)),
    [],
  );

  const handleCommand = useCallback((commandId: string) => {
    const kind = PROMPT_FOR_COMMAND[commandId];
    if (!kind) return false;

    setOpen(kind);
    return true;
  }, []);

  return useMemo(
    () => ({ open, openPrompt, closePrompt, togglePrompt, handleCommand }),
    [open, openPrompt, closePrompt, togglePrompt, handleCommand],
  );
}
