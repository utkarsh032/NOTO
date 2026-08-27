import { DEFAULT_ZOOM, ZOOM_LEVELS } from '@noto/config';

/**
 * Moving between zoom levels.
 *
 * Zoom is presentation only — it never touches the document — so this is
 * arithmetic over a fixed ladder rather than anything that knows about content.
 * Stepping along a ladder rather than multiplying by a factor is what makes
 * zooming in and back out land exactly where it started, and keeps 100%
 * reachable instead of approached.
 */

const LEVELS: readonly number[] = ZOOM_LEVELS;

const MIN_ZOOM = LEVELS[0] ?? DEFAULT_ZOOM;
const MAX_ZOOM = LEVELS[LEVELS.length - 1] ?? DEFAULT_ZOOM;

export { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM };

/** Clamps to the range the ladder covers. A stored value can be anything. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * The ladder index `zoom` sits at, or the nearest one below it.
 *
 * A value between two steps — from an older release with a different ladder, or
 * from a hand-edited settings file — snaps down rather than being rejected, so
 * one zoom press brings it back onto the ladder.
 */
function indexOf(zoom: number): number {
  const clamped = clampZoom(zoom);

  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    // A hair of tolerance: these are floats, and 1.1 typed twice is not
    // always the same 1.1.
    if ((LEVELS[i] as number) <= clamped + 1e-9) index = i;
  }

  return index;
}

export function zoomIn(zoom: number): number {
  const next = indexOf(zoom) + 1;
  return (LEVELS[Math.min(next, LEVELS.length - 1)] as number) ?? DEFAULT_ZOOM;
}

export function zoomOut(zoom: number): number {
  const current = indexOf(zoom);

  // Snap onto the ladder first when the value sits between two steps: zooming
  // out from 1.05 should give 1, not 0.9.
  const isOnLadder = Math.abs((LEVELS[current] as number) - clampZoom(zoom)) < 1e-9;
  const next = isOnLadder ? current - 1 : current;

  return (LEVELS[Math.max(next, 0)] as number) ?? DEFAULT_ZOOM;
}

export function canZoomIn(zoom: number): boolean {
  return clampZoom(zoom) < MAX_ZOOM - 1e-9;
}

export function canZoomOut(zoom: number): boolean {
  return clampZoom(zoom) > MIN_ZOOM + 1e-9;
}

/** Renders a zoom for display, e.g. `125%`. */
export function formatZoom(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}
