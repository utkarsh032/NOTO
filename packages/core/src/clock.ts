import type { IsoDateTime } from '@noto/types';

/**
 * The single source of "now" for core operations. Everything goes through this
 * so tests can freeze time without stubbing the global Date object.
 */
export interface Clock {
  now(): IsoDateTime;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

/** A clock frozen at a fixed instant, for deterministic tests. */
export function fixedClock(isoDateTime: IsoDateTime): Clock {
  return { now: () => isoDateTime };
}
