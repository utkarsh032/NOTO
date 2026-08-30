import { type ReactNode, useCallback, useEffect, useRef } from 'react';

import { cn } from '../utils/cn';
import { CloseIcon } from './icons';
import { IconButton } from './IconButton';

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  /** A line under the title saying what the dialog is for. */
  description?: string;
  /** Buttons, right-aligned under a divider. Omit for a dialog with no choices. */
  footer?: ReactNode;
  size?: DialogSize;
  children: ReactNode;
  className?: string;
  /** Hides the header entirely — for command surfaces that are their own title. */
  bare?: boolean;
}

const SIZE: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

/**
 * A modal dialog.
 *
 * Rendered in place rather than through a portal: Noto's shell is one tree
 * under `#root`, nothing clips it, and a portal would put the dialog outside
 * the theme attribute's subtree for no gain.
 *
 * Escape closes, the scrim closes, focus moves in on open and returns to
 * whatever opened it on close, and Tab is held inside for as long as it is up —
 * a modal the keyboard can walk out of is a modal only the mouse can use.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
  className,
  bare = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /* Where focus came from, so it has somewhere to go back to. */
  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    /*
     * The first field, if the dialog has one — a dialog that asks a question
     * should open with the caret where the answer goes. Otherwise the panel
     * itself, so the screen reader reads the title.
     */
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, [data-autofocus]',
    );
    (focusable ?? panel)?.focus();

    return () => {
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="noto-print-hidden fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh] sm:p-6 sm:pt-[12vh]"
      onKeyDown={onKeyDown}
    >
      {/* The scrim is a button so that dismissing by clicking away is a real
          control rather than a click handler on a decorative div. */}
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[var(--noto-scrim)]"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'border-default bg-surface relative z-10 w-full rounded-2xl border shadow-[var(--noto-shadow-lg)] outline-none',
          SIZE[size],
          className,
        )}
      >
        {bare ? null : (
          <header className="border-default flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-primary text-h3">{title}</h2>
              {description ? (
                <p className="text-secondary text-body-sm mt-1">{description}</p>
              ) : null}
            </div>
            <IconButton
              label="Close"
              icon={<CloseIcon className="h-5 w-5" />}
              onClick={onClose}
              className="-mt-1 -mr-2"
            />
          </header>
        )}

        {children}

        {footer ? (
          <footer className="border-default flex items-center justify-end gap-2 border-t px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
