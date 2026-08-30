import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface NavItemProps {
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onSelect(): void;
  /** A count or a badge, right-aligned. */
  trailing?: ReactNode;
  /** Icon-only, for the collapsed rail. */
  collapsed?: boolean;
  className?: string;
}

/**
 * One row of primary navigation.
 *
 * The active row is a soft brand tint with brand-strong text and a brand icon —
 * never a dark fill. Navigation is chrome, and chrome that shouts takes
 * attention from the document, which is the thing the user actually came for.
 */
export function NavItem({
  label,
  icon,
  isActive,
  onSelect,
  trailing,
  collapsed = false,
  className,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        'group/nav flex items-center rounded-md transition-colors',
        'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
        collapsed
          ? 'h-10 w-10 justify-center'
          : 'text-body-sm h-10 w-full gap-3 px-2.5 font-medium',
        isActive
          ? 'bg-brand-soft text-brand-strong'
          : 'text-secondary hover:bg-surface hover:text-primary',
        className,
      )}
    >
      <span className={cn('shrink-0', isActive ? 'text-brand-hover' : 'text-tertiary')}>
        {icon}
      </span>

      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {trailing ? <span className="shrink-0">{trailing}</span> : null}
        </>
      )}
    </button>
  );
}
