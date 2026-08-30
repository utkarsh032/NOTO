import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

export interface PageContainerProps {
  /** The screen's name. Rendered as the page's only `h1`. */
  title: string;
  /** One line saying what the screen is for. */
  subtitle?: string;
  /** Buttons and controls that belong beside the title. */
  actions?: ReactNode;
  /** A tab strip, drawn under the title block and above the content. */
  tabs?: ReactNode;
  /**
   * The screen's context panel — filters, summaries. Rendered as a sibling
   * landmark of `main`, and dropped below extra-large widths where taking 320px
   * from the content costs more than the panel gives.
   */
  aside?: ReactNode;
  /** The accessible name of that panel. */
  asideLabel?: string;
  children: ReactNode;
  /** `wide` fills the window; `reading` holds a measure. */
  width?: 'wide' | 'reading';
}

/**
 * The frame every screen except the workspace sits in.
 *
 * One scroller, 32px of page padding, and a title block that always looks the
 * same — so moving between Documents, Memory and Settings feels like moving
 * around one application rather than between three that were built separately.
 */
export function PageContainer({
  title,
  subtitle,
  actions,
  tabs,
  aside,
  asideLabel = 'Filters',
  children,
  width = 'wide',
}: PageContainerProps) {
  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="noto-scroll min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              'mx-auto w-full px-5 py-6 sm:px-8 sm:py-8',
              width === 'wide' ? 'max-w-[1280px]' : 'max-w-4xl',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-primary text-h1">{title}</h1>
                {subtitle ? <p className="text-secondary text-body mt-1.5">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>

            {tabs ? <div className="mt-6">{tabs}</div> : null}

            <div className={cn(tabs ? 'mt-6' : 'mt-8')}>{children}</div>
          </div>
        </div>
      </main>

      {aside ? (
        <aside
          aria-label={asideLabel}
          className="noto-print-hidden border-default bg-background w-context-panel hidden shrink-0 border-l xl:flex xl:flex-col"
        >
          <div className="noto-scroll-y min-h-0 flex-1 overflow-y-auto p-5">{aside}</div>
        </aside>
      ) : null}
    </>
  );
}
