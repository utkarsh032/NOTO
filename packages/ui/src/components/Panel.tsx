import type { HTMLAttributes } from 'react';

import { cn } from '../utils/cn';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `sunken` is for chrome such as the sidebar; `raised` for cards and popovers. */
  tone?: 'raised' | 'sunken';
}

export function Panel({ tone = 'raised', className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'border-border-subtle rounded-lg border',
        tone === 'raised' ? 'bg-surface-raised' : 'bg-surface-sunken',
        className,
      )}
      {...props}
    />
  );
}
