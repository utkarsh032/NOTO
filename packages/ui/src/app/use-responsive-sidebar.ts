import { useUiStore } from '@noto/core';
import { useEffect } from 'react';

/**
 * The width below which the desktop layout stops being a desktop layout.
 *
 * A 248px sidebar beside an 800px editing measure needs a little over a
 * thousand pixels before the document starts losing room it should not lose.
 */
const TABLET_QUERY = '(max-width: 1024px)';

/**
 * Collapses the sidebar when the window is too narrow to carry it.
 *
 * The design direction is desktop-first with sidebar + main + context panel;
 * below tablet width that becomes collapsed sidebar + main. Crossing the
 * threshold is what changes the state, not being on one side of it — so a user
 * who reopens the sidebar in a narrow window keeps it open, and a desktop user
 * who collapsed it deliberately does not have it reopened underneath them.
 */
export function useResponsiveSidebar(): void {
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia(TABLET_QUERY);

    /*
     * Read through `getState` rather than subscribing: this hook reacts to the
     * viewport, not to the flag, and writing a value the store already holds
     * would re-render every subscriber on the first frame for nothing.
     */
    if (useUiStore.getState().sidebarCollapsed !== query.matches) {
      setSidebarCollapsed(query.matches);
    }

    const onChange = (event: MediaQueryListEvent) => setSidebarCollapsed(event.matches);
    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [setSidebarCollapsed]);
}
