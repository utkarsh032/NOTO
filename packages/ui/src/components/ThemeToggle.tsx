import type { ThemeMode } from '@noto/types';

import { cn } from '../utils/cn';
import { MonitorIcon, MoonIcon, SunIcon, type IconProps } from './icons';

export interface ThemeToggleProps {
  value: ThemeMode;
  onChange(mode: ThemeMode): void;
  /** `sm` for dense headers and settings rows; `md` everywhere else. */
  size?: 'sm' | 'md';
  className?: string;
}

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  /** Where one more press goes. */
  next: ThemeMode;
}

/**
 * The three appearances, in the order a click walks through them: the two a
 * person can choose, then handing the choice back to the machine. Each one
 * names its successor, so the cycle is data rather than arithmetic on an index
 * that has to be proved in range.
 */
const OPTIONS: Record<ThemeMode, ThemeOption> = {
  light: { value: 'light', label: 'Light', icon: SunIcon, next: 'dark' },
  dark: { value: 'dark', label: 'Dark', icon: MoonIcon, next: 'system' },
  system: { value: 'system', label: 'System', icon: MonitorIcon, next: 'light' },
};

/** The stacked glyphs, in the same order, for rendering. */
const ORDER: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * The appearance switch: one button that cycles light → dark → system.
 *
 * It used to be a three-segment track. One button is smaller, reads as a single
 * affordance, and puts the state where the eye already is — the glyph *is* the
 * answer to "what appearance am I in", rather than a highlight among three.
 *
 * The swap is the whole point, so it is animated rather than instant: the three
 * glyphs are stacked on one another, and the outgoing one rotates and shrinks
 * away while the incoming one rotates in from the other side. Only `transform`
 * and `opacity` move, so the browser composites it. Motion is timed on
 * `--noto-duration-normal`, which a reduced-motion preference has already set
 * to zero: the glyph then simply changes.
 */
export function ThemeToggle({ value, onChange, size = 'md', className }: ThemeToggleProps) {
  const current = OPTIONS[value];
  const next = OPTIONS[current.next];

  const compact = size === 'sm';

  return (
    <button
      type="button"
      onClick={() => onChange(next.value)}
      /* The label carries both halves of the state: where you are, and what one
         more press will do. A screen reader user should not have to press it to
         find out. */
      aria-label={`Appearance: ${current.label}. Switch to ${next.label}.`}
      title={`${current.label} appearance — switch to ${next.label}`}
      className={cn(
        'border-default bg-surface-secondary text-secondary relative inline-flex shrink-0 items-center justify-center rounded-full border',
        'hover:border-brand-subtle hover:bg-brand-soft hover:text-brand-strong',
        'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-2',
        'transition-[color,background-color,border-color,transform] ease-out',
        'active:scale-90',
        compact ? 'h-8 w-8' : 'h-9 w-9',
        className,
      )}
      style={{ transitionDuration: 'var(--noto-duration-normal)' }}
    >
      {/*
       * The stage the glyphs share. All three are always mounted and stacked;
       * only one is visible, which is what lets the change be a movement
       * between them rather than one element being replaced by another.
       */}
      <span className={cn('relative block', compact ? 'h-4 w-4' : 'h-[18px] w-[18px]')}>
        {ORDER.map((mode) => {
          const isActive = mode === value;
          const Glyph = OPTIONS[mode].icon;

          return (
            <Glyph
              key={mode}
              className={cn(
                'absolute inset-0 h-full w-full transition-[transform,opacity] ease-out',
                isActive
                  ? 'scale-100 rotate-0 opacity-100'
                  : 'pointer-events-none scale-50 -rotate-90 opacity-0',
              )}
              style={{ transitionDuration: 'var(--noto-duration-normal)' }}
            />
          );
        })}
      </span>
    </button>
  );
}
