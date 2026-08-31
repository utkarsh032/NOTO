import { canZoomIn, canZoomOut, formatZoom, useSettingsStore, zoomIn, zoomOut } from '@noto/core';

import { StatusIndicator, type StatusKind } from '../../components/StatusIndicator';
import { HelpIcon, MinusIcon, PlusIcon } from '../../components/icons';
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
 * Zoom lives here rather than on the toolbar. It changes how the page is read
 * rather than what the page says, which is the same kind of fact as the word
 * count beside it, and it keeps the formatting bar for formatting.
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
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  return (
    <div
      className={cn(
        'noto-print-hidden border-default bg-surface text-tertiary text-caption flex h-10 shrink-0 items-center gap-4 border-t px-4 sm:px-6',
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

        {/*
         * One group of three rather than three loose controls: the level in the
         * middle is also the way back to 100%, which is where the hand already
         * is after pressing either side of it.
         */}
        <span className="hidden items-center gap-0.5 sm:flex">
          <ZoomButton
            label="Reset Zoom"
            zoomLabel={formatZoom(zoom)}
            onClick={() => updateEditor({ zoom: 1 })}
          />
          <ZoomStep
            label="Zoom Out"
            disabled={!canZoomOut(zoom)}
            onClick={() => updateEditor({ zoom: zoomOut(zoom) })}
          >
            <MinusIcon className="h-4 w-4" />
          </ZoomStep>
          <ZoomStep
            label="Zoom In"
            disabled={!canZoomIn(zoom)}
            onClick={() => updateEditor({ zoom: zoomIn(zoom) })}
          >
            <PlusIcon className="h-4 w-4" />
          </ZoomStep>
        </span>

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

function ZoomButton({
  label,
  zoomLabel,
  onClick,
}: {
  label: string;
  zoomLabel: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={`${label}. Currently ${zoomLabel}.`}
      title={label}
      className="text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand h-7 min-w-12 rounded-md px-1.5 tabular-nums transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1"
    >
      {zoomLabel}
    </button>
  );
}

function ZoomStep({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="border-default text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
