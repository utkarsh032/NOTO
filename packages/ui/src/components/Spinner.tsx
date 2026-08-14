import { cn } from '../utils/cn';

export interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'border-border-strong border-t-accent inline-block h-4 w-4 animate-spin rounded-full border-2',
        className,
      )}
    />
  );
}
