import { cn } from '../utils/cn';

export interface SpinnerProps {
  className?: string;
  label?: string;
}

/**
 * For short operations only. Anything that fills a region while it loads should
 * use `Skeleton` instead — a spinner in a page-sized hole tells the user
 * nothing about what is arriving.
 */
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'border-strong border-t-brand inline-block h-4 w-4 animate-spin rounded-full border-2',
        className,
      )}
    />
  );
}
