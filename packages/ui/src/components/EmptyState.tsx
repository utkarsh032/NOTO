import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** A small, quiet illustration. Home and first-run states earn one; lists do not. */
  illustration?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * What a region says when it has nothing in it yet.
 *
 * Short, and pointed at the one thing the user can do next — an empty state is
 * a prompt to start writing, not a page to read.
 */
export function EmptyState({
  title,
  description,
  illustration,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {illustration ? <div className="text-disabled mb-1">{illustration}</div> : null}
      <p className="text-primary text-h4">{title}</p>
      {description ? <p className="text-secondary text-body max-w-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
