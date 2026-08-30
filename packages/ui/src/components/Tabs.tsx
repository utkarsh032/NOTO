import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** A count, shown quietly after the label. */
  count?: number;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  value: T;
  /*
   * `NoInfer` on everything but `value`, so the tab type is decided by the
   * state being controlled. Otherwise a `useState` setter — which accepts an
   * updater function as well as a value — infers `T` as that union, fails the
   * `string` constraint, and lands back on `string` for every call site.
   */
  onChange(value: NoInfer<T>): void;
  items: TabItem<NoInfer<T>>[];
  /** The accessible name of the tab set, e.g. "Filter documents". */
  label: string;
  className?: string;
}

/**
 * The underline tabs that filter a screen's content.
 *
 * Arrow keys move between them, as a tablist should: the click target and the
 * keyboard target are the same control, so nobody has to Tab through six
 * filters to reach the list underneath.
 */
export function Tabs<T extends string>({ value, onChange, items, label, className }: TabsProps<T>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    onChange(items[next]!.value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'border-default noto-scroll-x flex items-end gap-1 overflow-x-auto border-b',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'text-body-sm -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 font-medium transition-colors',
              'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
              isActive
                ? 'border-brand text-brand-strong'
                : 'text-tertiary hover:text-primary border-transparent',
            )}
          >
            {item.icon}
            {item.label}
            {item.count === undefined ? null : (
              <span
                className={cn(
                  'text-caption rounded-full px-1.5 py-0.5 tabular-nums',
                  isActive
                    ? 'bg-brand-soft text-brand-strong'
                    : 'bg-surface-tertiary text-tertiary',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
