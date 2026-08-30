import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  /** Visible text. Omit for an icon-only segment and give `label` instead. */
  content?: ReactNode;
  /** The accessible name; required when the segment shows only an icon. */
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  /* `NoInfer` on everything but `value`: a `useState` setter accepts an updater
     function too, and inferring from it widens `T` past its `string`
     constraint — which resolves to bare `string` and rejects the setter. */
  onChange(value: NoInfer<T>): void;
  options: SegmentedOption<NoInfer<T>>[];
  /** The accessible name of the group, e.g. "View". */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Two or three mutually exclusive choices, shown at once.
 *
 * A list/grid switch, a density switch. Not for navigation — a set of tabs that
 * changes what is on the page is `Tabs`, and the difference matters to anyone
 * listening rather than looking.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'border-default bg-surface-secondary inline-flex items-center gap-0.5 rounded-md border p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            aria-label={option.content ? undefined : option.label}
            title={option.content ? undefined : option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-sm transition-colors',
              'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
              size === 'sm' ? 'text-caption h-7 px-2' : 'text-body-sm h-8 px-2.5',
              option.content ? 'font-medium' : size === 'sm' ? 'w-7 px-0' : 'w-8 px-0',
              isActive
                ? 'bg-surface text-primary shadow-sm'
                : 'text-tertiary hover:text-primary hover:bg-surface/60',
            )}
          >
            {option.icon}
            {option.content}
          </button>
        );
      })}
    </div>
  );
}
