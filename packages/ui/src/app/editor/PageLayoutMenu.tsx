import {
  MARGIN_PRESETS,
  PAGE_ORIENTATIONS,
  PAGE_SIZES,
  clampMargin,
  formatMargin,
  orientedPageSize,
  pageSize as findPageSize,
  resolveMargins,
} from '@noto/config';
import { useSettingsStore } from '@noto/core';
import type { PageMargins } from '@noto/types';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '../../components/Button';
import { Dropdown, type DropdownItem } from '../../components/Dropdown';
import { CheckIcon, PageLayoutIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { MarginFields } from './MarginFields';

/**
 * The page control: paper or no paper, what size, and what margins.
 *
 * Noto opens as a text file — text from the left edge of the window, no page to
 * speak of — because that is what someone opening a notepad wants. This menu is
 * where the other document lives: the one that is going to be printed, and has
 * to be seen at the size it will be printed at. Choosing a size or a set of
 * margins is itself the request for a page, so it turns the page on rather than
 * making the user say it twice.
 *
 * The margins are the ones every office suite ships, stated the way those
 * suites state them, so that Narrow means here what it means everywhere else.
 */

export interface PageLayoutMenuProps {
  /** Opens the custom margins form, which the toolbar draws under the bar. */
  onCustomMargins(): void;
}

export function PageLayoutMenu({ onCustomMargins }: PageLayoutMenuProps) {
  const { pageMode, pageSize, pageOrientation, marginPreset, customMargins } = useSettingsStore(
    (state) => state.settings.editor,
  );
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  const onPaper = pageMode === 'page';
  const check = (selected: boolean) => (selected ? <CheckIcon className="h-4 w-4" /> : undefined);

  const items: DropdownItem[] = [
    {
      id: 'mode.simple',
      label: 'Simple text',
      description: 'No page. Text runs the width of the window.',
      icon: <SimpleGlyph />,
      trailing: check(!onPaper),
      onSelect: () => updateEditor({ pageMode: 'simple' }),
    },
    {
      id: 'mode.page',
      label: 'Page layout',
      description: 'A sheet at its printed size, with margins.',
      icon: <MarginGlyph margins={resolveMargins(marginPreset, customMargins)} />,
      trailing: check(onPaper),
      onSelect: () => updateEditor({ pageMode: 'page' }),
    },

    ...PAGE_SIZES.map((size, index) => ({
      id: `size.${size.id}`,
      label: size.label,
      description: `${size.width} × ${size.height} in`,
      icon: <SizeGlyph width={size.width} height={size.height} />,
      trailing: check(onPaper && pageSize === size.id),
      separated: index === 0,
      /* Asking for Letter is asking for a page — there is nothing else a paper
         size could mean. The same goes for a set of margins. */
      onSelect: () => updateEditor({ pageMode: 'page', pageSize: size.id }),
    })),

    /*
     * Which way round the sheet goes.
     *
     * A size names paper, not the way it is held — Letter is 8.5 by 11 however
     * it is printed — so this is the same sheet turned, and each row states the
     * two numbers it will actually be. A wide table is what sends anybody
     * looking for this, and "11 × 8.5 in" is the answer they are checking for.
     */
    ...PAGE_ORIENTATIONS.map((orientation, index) => {
      const turned = orientedPageSize(findPageSize(pageSize), orientation.id);

      return {
        id: `orientation.${orientation.id}`,
        label: orientation.label,
        description: `${turned.width} × ${turned.height} in`,
        icon: <SizeGlyph width={turned.width} height={turned.height} />,
        trailing: check(onPaper && pageOrientation === orientation.id),
        separated: index === 0,
        onSelect: () => updateEditor({ pageMode: 'page', pageOrientation: orientation.id }),
      };
    }),

    /* Custom is in the presets too, but it is the last row here rather than
       one of these: it opens a form instead of applying four numbers. */
    ...MARGIN_PRESETS.flatMap((preset, index) =>
      preset.margins
        ? [
            {
              id: `margins.${preset.id}`,
              label: preset.label,
              description: describeMargins(preset.margins),
              icon: <MarginGlyph margins={preset.margins} />,
              trailing: check(onPaper && marginPreset === preset.id),
              separated: index === 0,
              onSelect: () => updateEditor({ pageMode: 'page', marginPreset: preset.id }),
            },
          ]
        : [],
    ),

    {
      id: 'margins.custom',
      label: 'Custom margins…',
      description: describeMargins(customMargins),
      icon: <MarginGlyph margins={customMargins} />,
      trailing: check(onPaper && marginPreset === 'custom'),
      /* The form focuses its first field, so the menu should not pull focus
         back to the trigger on the way out. */
      keepsFocus: true,
      onSelect: onCustomMargins,
    },
  ];

  return (
    <Dropdown
      align="left"
      label="Page layout"
      items={items}
      /* The toolbar scrolls sideways, so it clips what grows out of it: a menu
         drawn inside that box would be cut off at the bar's own height. */
      floating

      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          aria-label="Page layout"
          title="Page layout"
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm transition-colors',
            'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-1',
            onPaper
              ? 'bg-brand-soft text-brand-strong'
              : 'text-secondary hover:bg-surface-secondary hover:text-primary',
          )}
        >
          <PageLayoutIcon />
        </button>
      )}
    />
  );
}

/** The four numbers, in the order every word processor states them. */
function describeMargins({ top, bottom, left, right }: PageMargins): string {
  return `Top ${formatMargin(top)} · Bottom ${formatMargin(bottom)} · Left ${formatMargin(left)} · Right ${formatMargin(right)}`;
}

/* -------------------------------------------------------------------------- */
/* Glyphs                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Drawn here rather than added to the icon set, because these are not icons:
 * the inner frame is the margin the row is offering, to scale. Five identical
 * page glyphs would leave the reader to work the numbers out for themselves,
 * when the shape those numbers produce is the whole point of the row.
 */

const GLYPH_PAGE = { x: 5, y: 2, width: 14, height: 20 };

function MarginGlyph({ margins }: { margins: PageMargins }) {
  /* The glyph is a Letter page whatever size is chosen: it is showing the
     margins, not the paper. */
  const scaleX = GLYPH_PAGE.width / 8.5;
  const scaleY = GLYPH_PAGE.height / 11;

  const left = clampMargin(margins.left);
  const right = clampMargin(margins.right);
  const top = clampMargin(margins.top);
  const bottom = clampMargin(margins.bottom);

  return (
    <GlyphFrame>
      <rect {...GLYPH_PAGE} rx="1" />
      {/* The text block, filled rather than outlined: at 24px an outline of an
          outline is a smudge, and the point of the row is the column of text
          the margins leave behind. */}
      <rect
        x={GLYPH_PAGE.x + left * scaleX}
        y={GLYPH_PAGE.y + top * scaleY}
        width={Math.max(1, GLYPH_PAGE.width - (left + right) * scaleX)}
        height={Math.max(1, GLYPH_PAGE.height - (top + bottom) * scaleY)}
        fill="currentColor"
        stroke="none"
        className="opacity-30"
      />
    </GlyphFrame>
  );
}

/**
 * A sheet at its own proportions: Legal is visibly the long one.
 *
 * Sized against the tallest page the menu offers, so the three rows can be
 * compared with each other rather than each filling the same box.
 */
function SizeGlyph({ width, height }: { width: number; height: number }) {
  const tallest = Math.max(...PAGE_SIZES.map((size) => size.height));
  const drawnHeight = (GLYPH_PAGE.height * height) / tallest;
  const drawnWidth = (drawnHeight * width) / height;

  return (
    <GlyphFrame>
      <rect
        x={12 - drawnWidth / 2}
        y={GLYPH_PAGE.y + (GLYPH_PAGE.height - drawnHeight)}
        width={drawnWidth}
        height={drawnHeight}
        rx="1"
      />
    </GlyphFrame>
  );
}

function SimpleGlyph() {
  return (
    <GlyphFrame>
      <path d="M4 6h16" />
      <path d="M4 10.5h16" />
      <path d="M4 15h16" />
      <path d="M4 19.5h9" />
    </GlyphFrame>
  );
}

function GlyphFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Custom margins                                                             */
/* -------------------------------------------------------------------------- */

export interface PageMarginsPromptProps {
  onClose(): void;
}

/**
 * The margins, in inches, typed rather than picked.
 *
 * Held here until Apply: reflowing the page on every keystroke would show the
 * user a 1.2-inch margin on the way to the 1.25 they are typing, and the page
 * jumping under a half-finished number is worse than waiting for the finished
 * one. Cancel leaves the page exactly as it was found.
 */
export function PageMarginsPrompt({ onClose }: PageMarginsPromptProps) {
  const { customMargins, marginPreset } = useSettingsStore((state) => state.settings.editor);
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  /* Starts from what is on the page now, so Custom begins as a change to the
     margins in front of the user rather than as a blank form. */
  const [margins, setMargins] = useState<PageMargins>(() =>
    resolveMargins(marginPreset, customMargins),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    updateEditor({ pageMode: 'page', marginPreset: 'custom', customMargins: margins });
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      // Escape leaves the form wherever the caret is inside it, the way the
      // link and table prompts do.
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
      }}
      aria-label="Custom margins"
      className="border-default bg-surface-secondary mb-3 flex flex-wrap items-center gap-2 rounded-md border p-3"
    >
      <span className="text-secondary text-sm">Margins, in inches</span>

      <MarginFields autoFocus value={margins} onChange={setMargins} />

      <Button size="sm" variant="primary" type="submit">
        Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
