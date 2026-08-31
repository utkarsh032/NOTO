import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export type BadgeTone =
  'neutral' | 'brand' | 'success' | 'info' | 'warning' | 'danger' | 'ai' | 'memory' | 'capture';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Draws a dot in the badge's own colour before the label. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A pill.
 *
 * Semantic tones are tinted rather than filled: a row of filled badges turns
 * every list into a colour chart, and these colours are meant to carry meaning
 * on the rare occasions it matters.
 */
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-tertiary text-secondary',
  brand: 'bg-brand-soft text-brand-strong',
  success: 'bg-brand-soft text-brand-strong',
  info: 'text-info bg-info/10',
  warning: 'text-warning bg-warning/10',
  danger: 'text-danger bg-danger/10',
  ai: 'text-ai bg-ai-soft',
  memory: 'text-memory bg-memory/10',
  capture: 'text-capture bg-capture/10',
};

export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {/* Decoration, not information: the label beside it says the same thing,
          which is what keeps the state off colour alone. */}
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
