import { cn } from '../utils/cn';
import { Skeleton } from './Skeleton';

export interface LoadingStateProps {
  /** What is being loaded, announced to a screen reader. */
  label?: string;
  /** How many placeholder rows to draw. */
  rows?: number;
  /** `card` draws bordered blocks; `list` draws rows. */
  variant?: 'list' | 'card';
  className?: string;
}

/**
 * A region that is still loading, drawn in the shape of what is coming.
 *
 * Preferred over a spinner everywhere a list or a grid is on its way: the
 * layout is already the right height when the data lands, so nothing jumps
 * under the pointer at the moment the user reaches for it.
 */
export function LoadingState({
  label = 'Loading',
  rows = 4,
  variant = 'list',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('w-full', className)} aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>

      {variant === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="border-default bg-surface rounded-lg border p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              <Skeleton className="mt-4 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {Array.from({ length: rows }, (_, index) => (
            <li key={index} className="flex items-center gap-3 px-2 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="mt-2 h-3 w-1/5" />
              </span>
              <Skeleton className="h-3 w-20 shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
