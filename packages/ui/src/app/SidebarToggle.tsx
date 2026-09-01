import { useUiStore } from '@noto/core';

import { ChevronLeftIcon } from '../components/icons';
import { cn } from '../utils/cn';

export interface SidebarToggleProps {
  className?: string;
}

/**
 * The handle that opens and closes the sidebar.
 *
 * It sits on the seam itself — half in the sidebar, half in the pane beside it
 * — rather than inside the sidebar's own header, and it rides at the top of the
 * divider, on the brand bar's centre line. Three things follow from that, and
 * they are the reason for the placement:
 *
 *  - it never leaves. The old arrangement had a button in the sidebar header
 *    that collapsed it and a second one in the global header that brought it
 *    back, so the control the user had just pressed was not the one they had to
 *    press to undo it;
 *  - it points at what it does. A chevron on the divider means "move this
 *    edge", and it rotates through the change rather than being swapped for a
 *    different glyph;
 *  - it is where the hand already is. Everything a user reaches for at the top
 *    of the window — the wordmark, search, the avatar — sits on that line, and
 *    a handle floating at mid-height was the only control that did not.
 *
 * It carries the brand fill rather than a hairline outline: this is the one
 * control that changes the shape of the whole window, and half of it overhangs
 * the content pane, where a quiet pill would read as part of the document.
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
        'noto-print-hidden group absolute -right-3.5 z-30',
        'bg-brand text-on-brand hover:bg-brand-hover flex h-7 w-7 items-center justify-center rounded-lg shadow-md hover:shadow-lg',
        'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2',
        'transition-[background-color,box-shadow,transform] ease-out',
        'hover:scale-105 active:scale-95',
        className,
      )}
      style={{
        /* Centred on the brand bar, so the handle, the wordmark and the header
           beside it all sit on one line. */
        top: 'calc((var(--spacing-header) - 1.75rem) / 2)',
        transitionDuration: 'var(--noto-duration-normal)',
      }}
    >
      <ChevronLeftIcon
        className={cn('h-4 w-4 transition-transform ease-out', collapsed && 'rotate-180')}
        style={{ transitionDuration: 'var(--noto-duration-normal)' }}
      />
    </button>
  );
}
