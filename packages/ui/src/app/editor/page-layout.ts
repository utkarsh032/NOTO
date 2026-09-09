import {
  type PageSize,
  clampMargin,
  pageSize as findPageSize,
  orientedPageSize,
  resolveMargins,
} from '@noto/config';
import { useSettingsStore } from '@noto/core';
import type { PageLayoutMode, PageMargins } from '@noto/types';
import { type CSSProperties, useEffect, useMemo } from 'react';

/**
 * What the editor should draw: a text file, or a sheet of paper.
 *
 * The settings hold the user's choice in the terms they made it — "Letter",
 * "Narrow" — and this turns that into the two things the editor needs: the
 * size of the sheet and the margins around it. One place does the resolving so
 * the screen and the printed page cannot disagree about what Narrow was.
 */

export interface ResolvedPageLayout {
  mode: PageLayoutMode;
  /** The sheet as it will be held — already turned, if landscape was chosen. */
  size: PageSize;
  /** Inches, already clamped to something a page can actually hold. */
  margins: PageMargins;
}

export function usePageLayout(): ResolvedPageLayout {
  const { pageMode, pageSize, pageOrientation, marginPreset, customMargins } = useSettingsStore(
    (state) => state.settings.editor,
  );

  return useMemo(() => {
    const resolved = resolveMargins(marginPreset, customMargins);

    return {
      mode: pageMode,
      size: orientedPageSize(findPageSize(pageSize), pageOrientation),
      margins: {
        top: clampMargin(resolved.top),
        bottom: clampMargin(resolved.bottom),
        left: clampMargin(resolved.left),
        right: clampMargin(resolved.right),
      },
    };
  }, [pageMode, pageSize, pageOrientation, marginPreset, customMargins]);
}

/**
 * The sheet's dimensions, as CSS.
 *
 * Inches rather than pixels: CSS defines an inch as 96px, so a Letter page is
 * 816px wide on screen and 8.5 inches wide on paper from the same declaration.
 * `maxWidth` is what keeps the page usable on a phone — the sheet shrinks
 * rather than sliding off the side of the window.
 */
export function sheetStyle({ size, margins }: ResolvedPageLayout): CSSProperties {
  return {
    width: `${size.width}in`,
    maxWidth: '100%',
    minHeight: `${size.height}in`,
    paddingTop: `${margins.top}in`,
    paddingBottom: `${margins.bottom}in`,
    paddingLeft: `${margins.left}in`,
    paddingRight: `${margins.right}in`,
  };
}

/** The id of the style element the print rule is written into. */
const PRINT_RULE_ID = 'noto-page-rule';

/**
 * Teaches the printer the page the user chose.
 *
 * `@page` cannot read a custom property, so the rule is written out with the
 * numbers in it and rewritten whenever they change. In simple mode there is no
 * rule at all: a text file has no page size to impose, and the browser's own
 * margins are the right answer for one.
 */
export function usePrintPageRule({ mode, size, margins }: ResolvedPageLayout): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById(PRINT_RULE_ID);
    if (mode !== 'page') {
      existing?.remove();
      return;
    }

    const element = existing ?? document.createElement('style');
    element.id = PRINT_RULE_ID;
    element.textContent = `@page { size: ${size.width}in ${size.height}in; margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in; }`;
    if (!existing) document.head.append(element);

    return () => element.remove();
  }, [mode, size.width, size.height, margins.top, margins.right, margins.bottom, margins.left]);
}
