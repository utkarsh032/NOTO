import type { MarginPresetId, PageMargins, PageOrientation, PageSizeId } from '@noto/types';

/**
 * Paper: the sizes a page can be, and the margins that can be set around it.
 *
 * Everything here is in inches, because that is the unit every word processor
 * states margins in and the one a user recognises when they read "Top: 1"".
 * The editor turns them into CSS inches, which browsers define as exactly
 * 96px — so a page on screen is the same page that comes out of the printer.
 *
 * Shared rather than kept in the editor because print, export and the settings
 * screen all have to agree on what "Narrow" means.
 */

export interface PageSize {
  id: PageSizeId;
  label: string;
  /** Inches, as the sheet is named — which is always portrait. */
  width: number;
  height: number;
}

export const PAGE_SIZES: readonly PageSize[] = [
  { id: 'letter', label: 'Letter', width: 8.5, height: 11 },
  { id: 'a4', label: 'A4', width: 8.27, height: 11.69 },
  { id: 'legal', label: 'Legal', width: 8.5, height: 14 },
];

export const DEFAULT_PAGE_SIZE: PageSizeId = 'letter';

export function pageSize(id: PageSizeId): PageSize {
  return PAGE_SIZES.find((size) => size.id === id) ?? PAGE_SIZES[0]!;
}

export const DEFAULT_PAGE_ORIENTATION: PageOrientation = 'portrait';

/** The two ways round, in the order a page setup dialog has always listed them. */
export const PAGE_ORIENTATIONS: readonly { id: PageOrientation; label: string }[] = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
];

/**
 * The sheet as it will actually be held.
 *
 * Sizes are named portrait — Letter is 8.5 by 11 whichever way it is printed —
 * so landscape is the same sheet with its two numbers swapped. Doing it here
 * means the editor, the print rule and anything else that needs a page all turn
 * it the same way.
 */
export function orientedPageSize(size: PageSize, orientation: PageOrientation): PageSize {
  if (orientation !== 'landscape') return size;

  return { ...size, width: size.height, height: size.width };
}

export interface MarginPreset {
  id: MarginPresetId;
  label: string;
  /**
   * The values, or `null` for `custom` — which has no fixed values by
   * definition, and reads the ones the user set instead.
   */
  margins: PageMargins | null;
}

/**
 * The named margins, in the order the menu lists them.
 *
 * These are the widths every office suite has shipped for twenty years. They
 * are here rather than invented because a document set to "Narrow" in Noto and
 * opened in Word should be the same document, not one a quarter-inch off.
 */
export const MARGIN_PRESETS: readonly MarginPreset[] = [
  { id: 'normal', label: 'Normal', margins: { top: 1, bottom: 1, left: 1, right: 1 } },
  { id: 'narrow', label: 'Narrow', margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } },
  { id: 'moderate', label: 'Moderate', margins: { top: 1, bottom: 1, left: 0.75, right: 0.75 } },
  { id: 'wide', label: 'Wide', margins: { top: 1, bottom: 1, left: 2, right: 2 } },
  {
    id: 'office2003',
    label: 'Office 2003 Default',
    margins: { top: 1, bottom: 1, left: 1.25, right: 1.25 },
  },
  { id: 'custom', label: 'Custom margins', margins: null },
];

export const DEFAULT_MARGIN_PRESET: MarginPresetId = 'normal';

export const DEFAULT_CUSTOM_MARGINS: PageMargins = { top: 1, bottom: 1, left: 1, right: 1 };

/** The widest margin worth allowing: past this there is no column left to write in. */
export const MAX_MARGIN_INCHES = 4;

/**
 * The margins a preset means, with `custom` reading the user's own.
 *
 * Falls back to Normal for a preset id that is no longer known, which is what
 * settings written by a newer version and read by an older one look like.
 */
export function resolveMargins(preset: MarginPresetId, custom: PageMargins): PageMargins {
  if (preset === 'custom') return custom;
  return MARGIN_PRESETS.find((entry) => entry.id === preset)?.margins ?? DEFAULT_CUSTOM_MARGINS;
}

/**
 * Holds a typed margin somewhere usable.
 *
 * A margin wider than the page leaves nothing to write on, and a negative one
 * is not a margin at all — but the field is a number input, so both can be
 * typed. Clamped rather than rejected: the user is mid-edit, and refusing the
 * keystroke would fight them.
 */
export function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_MARGIN_INCHES, Math.max(0, value));
}

/** Formats a margin the way the menu states it: `0.5"`, `1"`, `1.25"`. */
export function formatMargin(value: number): string {
  return `${Number(value.toFixed(2))}"`;
}
