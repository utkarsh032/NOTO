import { useEffect, useState } from 'react';

/**
 * Which shape the application is in.
 *
 * `mobile` is not a narrow desktop: it swaps the sidebar for a bottom bar and
 * drops the context panel entirely, which is a different layout rather than the
 * same one squeezed. `tablet` keeps the desktop layout with the sidebar
 * collapsed to its rail.
 */
export type Viewport = 'mobile' | 'tablet' | 'desktop';

/** Below this the layout changes shape; below the first, it changes kind. */
const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function read(): Viewport {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth <= MOBILE_MAX) return 'mobile';
  if (window.innerWidth <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    /*
     * Two queries rather than a resize listener: the browser evaluates these
     * itself and only calls back when a threshold is actually crossed, so
     * dragging a window edge does not re-render the shell on every frame.
     */
    const queries = [
      window.matchMedia(`(max-width: ${MOBILE_MAX}px)`),
      window.matchMedia(`(max-width: ${TABLET_MAX}px)`),
    ];

    const onChange = () => setViewport(read());

    for (const query of queries) query.addEventListener('change', onChange);
    onChange();

    return () => {
      for (const query of queries) query.removeEventListener('change', onChange);
    };
  }, []);

  return viewport;
}
