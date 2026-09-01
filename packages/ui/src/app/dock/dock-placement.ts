/**
 * Where the Quick Note dock sits, and whether it is out at all.
 *
 * Two numbers and a flag, because that is the whole of it: which edge the
 * handle is stuck to, how far down that edge, and whether the user wants it.
 * The desktop's dock is an operating-system window and stores its placement in
 * the main process; the in-application dock stores it here. Both speak in the
 * same terms, so the same handle and the same panel serve both.
 */

export type DockSide = 'left' | 'right';

export interface DockPlacement {
  side: DockSide;
  /**
   * How far down the edge, as a fraction between 0 and 1.
   *
   * A fraction rather than a pixel offset: the window gets resized, the display
   * gets changed, and a dock remembered at "820px from the top" ends up off the
   * bottom of a laptop screen. A fraction lands in the same *place* instead.
   */
  offset: number;
  /** Whether the handle is on screen. */
  enabled: boolean;
}

export const DEFAULT_DOCK_PLACEMENT: DockPlacement = {
  side: 'right',
  offset: 0.55,
  enabled: false,
};

const STORAGE_KEY = 'noto.quick-note.dock';

/** Keeps the handle wholly on screen, however small the window gets. */
export function clampOffset(offset: number): number {
  if (!Number.isFinite(offset)) return DEFAULT_DOCK_PLACEMENT.offset;
  return Math.min(0.92, Math.max(0.04, offset));
}

/*
 * The placement is read on every render that subscribes to it, and it has to be
 * the *same object* every time until it actually changes: `useSyncExternalStore`
 * compares snapshots by identity, and a component handed a freshly parsed object
 * on each read would re-render itself forever.
 *
 * So the parse is cached and thrown away by the one thing that can invalidate
 * it — a write, here or in another window.
 */
let cached: DockPlacement | null = null;

const listeners = new Set<() => void>();

/** Whether the cross-window listener has been installed. Once is enough. */
let watching = false;

function parse(): DockPlacement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DOCK_PLACEMENT;

    const stored = JSON.parse(raw) as Partial<DockPlacement>;

    return {
      side: stored.side === 'left' ? 'left' : 'right',
      offset: clampOffset(Number(stored.offset)),
      enabled: stored.enabled === true,
    };
  } catch {
    /* Unreadable or blocked storage means the default, not a broken dock. */
    return DEFAULT_DOCK_PLACEMENT;
  }
}

/**
 * Drops the cache and tells everyone.
 *
 * One place does both, and every subscriber shares this single listener rather
 * than installing a `storage` handler of its own — otherwise the first
 * subscriber's handler would invalidate the cache while the second was still
 * about to, and two components would be handed two equal-but-different objects
 * for the same change.
 */
function invalidate(): void {
  cached = null;
  for (const listener of [...listeners]) listener();
}

export function readDockPlacement(): DockPlacement {
  cached ??= parse();
  return cached;
}

export function writeDockPlacement(placement: DockPlacement): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(placement));
  } catch {
    // The dock still moves; it just will not be there next launch.
  }

  invalidate();
}

export function subscribeToDockPlacement(listener: () => void): () => void {
  /*
   * `storage` fires in every window *except* the one that wrote — which is why
   * `writeDockPlacement` notifies directly as well. Together they cover both
   * the application window and the desktop's separate dock window.
   */
  if (!watching && typeof window !== 'undefined') {
    watching = true;
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === STORAGE_KEY) invalidate();
    });
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Turns the dock on or off without disturbing where it sits. */
export function setDockEnabled(enabled: boolean): void {
  writeDockPlacement({ ...readDockPlacement(), enabled });
}
