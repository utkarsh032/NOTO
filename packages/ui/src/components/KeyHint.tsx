import { cn } from '../utils/cn';

export interface KeyHintProps {
  /** Already formatted for the platform, e.g. "Ctrl K" or "⌘K". */
  keys: string;
  className?: string;
}

/**
 * A keyboard shortcut, shown next to the thing it triggers.
 *
 * Marked up as `kbd` and hidden from screen readers: the control it sits beside
 * already announces its own shortcut in its label, and reading "Ctrl K" as two
 * stray words after every menu item is noise.
 */
export function KeyHint({ keys, className }: KeyHintProps) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        'border-default bg-surface-secondary text-tertiary text-caption inline-flex h-6 items-center rounded-sm border px-1.5 font-sans font-medium',
        className,
      )}
    >
      {keys}
    </kbd>
  );
}
