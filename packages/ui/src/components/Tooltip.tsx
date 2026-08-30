import { type ReactNode, useId, useRef, useState } from 'react';

import { cn } from '../utils/cn';

export interface TooltipProps {
  /** The text shown on hover or focus. Keep it to a few words. */
  content: ReactNode;
  side?: 'top' | 'bottom';
  children: ReactNode;
  className?: string;
}

/** Long enough not to fire while the pointer crosses a toolbar. */
const OPEN_DELAY_MS = 350;

/**
 * A tooltip for a control whose glyph is not self-explanatory.
 *
 * It supplements the accessible name rather than supplying it — the control
 * inside still carries its own label — so nothing here is the only way to learn
 * what a button does. Focus opens it immediately; the pointer waits, because a
 * tooltip that fires on the way past is noise.
 */
export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const openLater = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const closeNow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={openLater}
      onPointerLeave={closeNow}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={closeNow}
      /* Escape dismisses a tooltip without moving focus, per WAI-ARIA. */
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeNow();
      }}
      aria-describedby={open ? id : undefined}
    >
      {children}

      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'text-caption pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md px-2 py-1 whitespace-nowrap',
            'bg-primary text-inverted shadow-[var(--noto-shadow-md)]',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
