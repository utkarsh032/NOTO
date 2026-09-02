import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  canZoomIn,
  canZoomOut,
  clampZoom,
  formatZoom,
  zoomIn,
  zoomOut,
} from './zoom.ts';

describe('clampZoom', () => {
  it('keeps a value the ladder covers', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('pulls anything outside the ladder back onto its ends', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
  });

  it('falls back for a value that is not a number at all', () => {
    // A hand-edited settings file, or one written by an older release.
    expect(clampZoom(Number.NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM);
  });
});

describe('zoomIn / zoomOut', () => {
  it('steps along the ladder', () => {
    expect(zoomIn(1)).toBe(1.1);
    expect(zoomOut(1)).toBe(0.9);
  });

  it('comes back to exactly where it started', () => {
    // The reason for a ladder rather than a multiplier: 1 stays reachable.
    let zoom = 1;
    for (let i = 0; i < 3; i += 1) zoom = zoomIn(zoom);
    for (let i = 0; i < 3; i += 1) zoom = zoomOut(zoom);

    expect(zoom).toBe(1);
  });

  it('stops at the ends rather than running past them', () => {
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM);
  });

  it('snaps a value between two steps back onto the ladder', () => {
    // Zooming out from 1.05 should give 1, not skip past it to 0.9.
    expect(zoomOut(1.05)).toBe(1);
    expect(zoomIn(1.05)).toBe(1.1);
  });

  it('recovers from a value outside the ladder', () => {
    // Clamped onto the ladder first, then stepped — so an absurd stored zoom
    // is one press away from something sensible rather than stuck.
    expect(zoomOut(50)).toBe(1.75);
    expect(zoomIn(0.01)).toBe(0.9);
  });
});

describe('canZoomIn / canZoomOut', () => {
  it('reports the ends, so the controls can go quiet there', () => {
    expect(canZoomIn(MAX_ZOOM)).toBe(false);
    expect(canZoomOut(MIN_ZOOM)).toBe(false);
    expect(canZoomIn(1)).toBe(true);
    expect(canZoomOut(1)).toBe(true);
  });
});

describe('formatZoom', () => {
  it('reads as a percentage', () => {
    expect(formatZoom(1)).toBe('100%');
    expect(formatZoom(1.25)).toBe('125%');
    expect(formatZoom(0.8)).toBe('80%');
  });
});
