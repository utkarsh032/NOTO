import { useUiStore } from '@noto/core';

import { ChevronLeftIcon } from '../components/icons';
import { cn } from '../utils/cn';

export interface SidebarToggleProps {
  className?: string;
}

/**
 * The handle that opens and closes the sidebar.
 *
 * It sits on the seam itself — half in the sidebar, half in the pane beside it,
 * at the height where the two meet the rest of the window — rather than inside
 * the sidebar's own header. Three things follow from that, and they are the
 * reason for the move:
 *
 *  - it never leaves. The old arrangement had a button in the sidebar header
 *    that collapsed it and a second one in the global header that brought it
 *    back, so the control the user had just pressed was not the one they had to
 *    press to undo it;
 *  - it points at what it does. A chevron on the divider means "move this
 *    edge", and it rotates through the change rather than being swapped for a
 *    different glyph;
 *  - it stops competing with the wordmark for the top-left corner, which is the
 *    one part of the window that should only ever say what the product is.
 *
 * Resting, it is a quiet hairline pill on the divider; on hover or focus it
 * takes the brand tint and grows very slightly, which is the whole animation.
 */
export function SidebarToggle({ className }: SidebarToggleProps) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className={cn(
        'noto-print-hidden group absolute top-1/2 -right-3 z-30 -translate-y-1/2',
        'border-default bg-surface text-tertiary flex h-11 w-6 items-center justify-center rounded-full border shadow-sm',
        'hover:border-brand-subtle hover:bg-brand-soft hover:text-brand-strong hover:shadow-md',
        'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2',
        'transition-[color,background-color,border-color,box-shadow,transform] ease-out',
        'hover:scale-105 active:scale-95',
        className,
      )}
      style={{ transitionDuration: 'var(--noto-duration-normal)' }}
    >
      <ChevronLeftIcon
        className={cn('h-4 w-4 transition-transform ease-out', collapsed && 'rotate-180')}
        style={{ transitionDuration: 'var(--noto-duration-normal)' }}
      />
    </button>
  );
}
