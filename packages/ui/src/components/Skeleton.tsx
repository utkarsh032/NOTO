import { cn } from '../utils/cn';

export interface SkeletonProps {
  className?: string;
}

/**
 * A placeholder in the shape of the thing that is loading.
 *
 * Preferred over a spinner for anything that fills a region: it says how much
 * is coming and stops the layout jumping when it lands.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn('noto-skeleton block h-4 w-full', className)} />;
}

export interface SkeletonTextProps {
  /** How many lines to draw. The last one is shortened, the way text ends. */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'w-2/3' : undefined} />
      ))}
    </div>
  );
}
