import type { HTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `secondary` is for chrome such as the sidebar; `raised` for popovers. */
  tone?: 'raised' | 'secondary';
}

/**
 * A large surface — a context panel, a popover, a region of chrome.
 *
 * Use `Card` for content the user reads as one item; a panel is the container
 * such things sit in.
 */
export function Panel({ tone = 'raised', className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'border-default rounded-xl border',
        tone === 'raised' ? 'bg-surface shadow-sm' : 'bg-surface-secondary',
        className,
      )}
      {...props}
    />
  );
}
