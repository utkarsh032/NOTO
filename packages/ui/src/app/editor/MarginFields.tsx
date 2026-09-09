import { MAX_MARGIN_INCHES, clampMargin } from '@noto/config';
import type { PageMargins } from '@noto/types';
import { useEffect, useRef, useState } from 'react';

import { fieldClasses } from '../../components/field-styles';
import { cn } from '../../utils/cn';

/**
 * The four margins, typed.
 *
 * The fields keep their own text rather than reading numbers straight back out
 * of the setting. A controlled number input rewritten from a parsed value eats
 * the decimal point the moment it is typed — "1." parses to 1, comes back as
 * "1", and the user can never reach 1.25. So the text is the user's, and the
 * number is published alongside it whenever the text is one.
 *
 * Used by the toolbar's margins form and by the settings screen, which differ
 * only in when they commit: the form waits for Apply, the settings screen
 * applies as it goes.
 */

const FIELDS = [
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
] as const;

type MarginKey = (typeof FIELDS)[number]['key'];

export interface MarginFieldsProps {
  value: PageMargins;
  /** Called on every keystroke that reads as a number, already clamped. */
  onChange(next: PageMargins): void;
  /** Focuses the first field on mount, for a form that opened on a click. */
  autoFocus?: boolean;
  className?: string;
}

export function MarginFields({ value, onChange, autoFocus = false, className }: MarginFieldsProps) {
  const [draft, setDraft] = useState<Record<MarginKey, string>>(() => toText(value));

  /*
   * A change from outside — a preset chosen in the menu — replaces what is in
   * the fields. A change this component just published does not, or the text
   * would be rewritten from the number it was parsed into.
   */
  const published = useRef(value);
  useEffect(() => {
    if (isSame(published.current, value)) return;
    published.current = value;
    setDraft(toText(value));
  }, [value]);

  const edit = (key: MarginKey, text: string) => {
    const next = { ...draft, [key]: text };
    setDraft(next);

    if (text.trim() === '' || !Number.isFinite(Number(text))) return;

    const margins: PageMargins = {
      top: clampMargin(Number(next.top)),
      bottom: clampMargin(Number(next.bottom)),
      left: clampMargin(Number(next.left)),
      right: clampMargin(Number(next.right)),
    };

    published.current = margins;
    onChange(margins);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {FIELDS.map((field, index) => (
        <label key={field.key} className="text-secondary flex items-center gap-1.5 text-sm">
          {field.label}
          <input
            autoFocus={autoFocus && index === 0}
            value={draft[field.key]}
            onChange={(event) => edit(field.key, event.target.value)}
            type="number"
            inputMode="decimal"
            step="0.05"
            min={0}
            max={MAX_MARGIN_INCHES}
            aria-label={`${field.label} margin, in inches`}
            className={cn(fieldClasses('sm'), 'w-20')}
          />
        </label>
      ))}
    </div>
  );
}

function toText(margins: PageMargins): Record<MarginKey, string> {
  return {
    top: String(margins.top),
    bottom: String(margins.bottom),
    left: String(margins.left),
    right: String(margins.right),
  };
}

function isSame(a: PageMargins, b: PageMargins): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;
}
