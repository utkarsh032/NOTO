import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `md` is the default 24px; `sm` is for dense lists. */
  padding?: 'none' | 'sm' | 'md';
  /**
   * `true` when the card is a link or a row. Adds the hover and focus states a
   * clickable surface needs; it does not make the card itself focusable.
   */
  interactive?: boolean;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
};

/**
 * A card: white, lightly bordered, barely shadowed.
 *
 * Border first and shadow second — a heavy shadow reads as a dialog that has
 * come loose from the page, which is the opposite of what a card is for.
 */
export function Card({
  padding = 'md',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'border-default bg-surface rounded-lg border shadow-sm',
        interactive &&
          'hover:border-strong focus-within:border-brand focus-within:ring-brand-muted transition-shadow focus-within:ring-3 hover:shadow-md',
        PADDING[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** Supporting line under the title. */
  description?: ReactNode;
  /** Actions, a badge, a timestamp — anything that belongs on the title row. */
  trailing?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, trailing, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-primary text-h4 truncate">{title}</h3>
        {description ? <p className="text-secondary text-body-sm mt-1">{description}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
