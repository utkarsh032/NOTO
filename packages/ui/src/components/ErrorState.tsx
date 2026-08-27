import type { ReactNode } from 'react';

import { cn } from '../utils/cn';
import { AlertIcon } from './icons';

export interface ErrorStateProps {
  /** What happened, in the user's terms. */
  title: string;
  /** Whether their data is safe, and what happens next. */
  description?: ReactNode;
  /** What they can do about it — usually a retry. */
  action?: ReactNode;
  className?: string;
}

/**
 * An error the user can do something about.
 *
 * Three things, in this order: what happened, whether their work is safe, and
 * what they can do. Leaving the middle one out is what makes an error message
 * frightening rather than useful.
 */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <AlertIcon className="text-danger h-6 w-6" />
      <p className="text-primary text-h4">{title}</p>
      {description ? <div className="text-secondary text-body max-w-sm">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
