import type { ReactNode } from 'react';

export interface NotoAppShellProps {
  /** The sidebar, or nothing at all on a phone. */
  sidebar?: ReactNode;
  header: ReactNode;
  /** `main`, and any context panel beside it — screens supply their own. */
  children: ReactNode;
  /** The bottom bar, on a phone. */
  bottomNav?: ReactNode;
}

/**
 * The application frame: sidebar beside a column of header, content and — on a
 * phone — a bottom bar.
 *
 * It owns no state and makes no decisions. Everything variable about the layout
 * is a slot, so the same frame serves the workspace with its editor and context
 * panel, a settings screen with a sidebar of its own, and a phone with neither.
 *
 * `h-full` and `overflow-hidden` are the load-bearing part: Noto scrolls inside
 * its panes, never as a page, so the window is a fixed frame and every scroller
 * inside it keeps its own position.
 */
export function NotoAppShell({ sidebar, header, children, bottomNav }: NotoAppShellProps) {
  return (
    <div className="bg-background flex h-full overflow-hidden">
      {sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        {header}

        <div className="flex min-h-0 flex-1">{children}</div>

        {bottomNav}
      </div>
    </div>
  );
}
