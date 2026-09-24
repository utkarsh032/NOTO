import { LoadingState } from '../../components/LoadingState';
import { Skeleton } from '../../components/Skeleton';

/**
 * What fills the window while the guard decides, on the routes that render
 * without the shell around them.
 *
 * Deliberately almost nothing. It is on screen for a frame or two — long
 * enough that the window is never blank, short enough that anything more
 * would be a flash of interface that then goes away.
 */
export function WindowLoading() {
  return (
    <div className="bg-background flex h-full items-center justify-center" aria-busy="true">
      <span className="sr-only" role="status">
        Checking your account
      </span>
    </div>
  );
}

/**
 * What fills the pane while a screen's chunk is fetched.
 *
 * The shell is already on screen by then — sidebar, tabs and all — so this is
 * only ever the content area, and it holds the page's shape so nothing under
 * the pointer moves when the screen lands.
 */
export function ScreenLoading() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full px-5 py-6 sm:px-8 sm:py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8">
          <LoadingState label="Opening" rows={5} />
        </div>
      </div>
    </main>
  );
}
