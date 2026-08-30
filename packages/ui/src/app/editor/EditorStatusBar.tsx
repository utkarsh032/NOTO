import { formatZoom } from '@noto/core';

import { StatusIndicator, type StatusKind } from '../../components/StatusIndicator';
import { HelpIcon } from '../../components/icons';
import { cn } from '../../utils/cn';

export type EditorSaveState = 'saved' | 'unsaved' | 'saving';

export interface EditorStatusBarProps {
  words: number;
  characters: number;
  saveState: EditorSaveState;
  /** `true` when the application knows it cannot reach the network. */
  offline?: boolean;
  zoom: number;
  onHelp(): void;
  className?: string;
}

/** Local-first, so this says "Saved", not "Synced". */
const SAVE: Record<EditorSaveState, { status: StatusKind; label: string }> = {
  saved: { status: 'saved', label: 'Saved' },
  unsaved: { status: 'pending', label: 'Unsaved changes' },
  saving: { status: 'busy', label: 'Saving…' },
};

/**
 * The strip under the editor: how much you have written, whether it is safe,
 * and how big it is on screen.
 *
 * Everything here is about the document rather than in it, which is why it sits
 * outside the scroller — it should be true at a glance without scrolling to the
 * end to check.
 *
 * Zoom is reported, not operated. The toolbar already carries the control, and
 * a second set of the same three buttons is a second thing to keep in step for
 * no gain — this is the read-out that tells you what the control did.
 */
export function EditorStatusBar({
  words,
  characters,
  saveState,
  offline = false,
  zoom,
  onHelp,
  className,
}: EditorStatusBarProps) {
  const save = SAVE[saveState];

  return (
    <div
      className={cn(
        'noto-print-hidden border-default bg-surface-secondary text-tertiary text-caption flex h-9 shrink-0 items-center gap-4 border-t px-4 sm:px-6',
        className,
      )}
    >
      <span className="tabular-nums">{words.toLocaleString()} words</span>
      <span className="hidden tabular-nums sm:inline">
        {characters.toLocaleString()} characters
      </span>
      <span className="hidden md:inline">English (US)</span>

      <span className="ml-auto flex items-center gap-3">
        {/* Offline is a normal state for a local-first application, so it is
            said plainly and in amber rather than as a failure. */}
        {offline ? <StatusIndicator status="offline" label="Offline • Saved locally" /> : null}

        <StatusIndicator status={save.status} label={save.label} />

        <span className="bg-default hidden h-4 w-px sm:block" aria-hidden="true" />

        <span className="hidden tabular-nums sm:inline">{formatZoom(zoom)}</span>

        <button
          type="button"
          onClick={onHelp}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="hover:text-primary focus-visible:outline-brand rounded-sm transition-colors focus-visible:outline-2"
        >
          <HelpIcon className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}
