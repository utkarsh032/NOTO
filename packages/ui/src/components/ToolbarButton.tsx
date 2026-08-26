import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface ToolbarButtonProps {
  /** What the button does, e.g. "Bold". Becomes the accessible name. */
  label: string;
  /** Rendered after the label in the tooltip, already formatted for the platform. */
  shortcutHint?: string;
  /** `true` when the selection already has this format. Renders as a pressed toggle. */
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * One control in the editor toolbar.
 *
 * Clicking a button must not take the caret out of the document — the command
 * behind it acts on the selection, and a selection the user can no longer see
 * is one they cannot tell they are formatting. Suppressing `mousedown` keeps
 * focus in the editor, so the highlight stays put while the button is pressed.
 */
export function ToolbarButton({
  label,
  shortcutHint,
  isActive = false,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      title={shortcutHint ? `${label} (${shortcutHint})` : label}
      className={cn(
        'inline-flex h-8 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        isActive
          ? 'bg-accent-subtle text-content'
          : 'text-muted hover:bg-surface-sunken hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
