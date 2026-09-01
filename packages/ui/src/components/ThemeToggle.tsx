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
}

/**
 * The three appearances, in the order a person reasons about them: the two they
 * can choose, then handing the choice back to the machine.
 */
const OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
];

/**
 * The appearance switch.
 *
 * One control holding all three modes rather than two buttons and a menu entry:
 * "match the system" is an appearance like the other two, and hiding it in the
 * account menu meant the header could show a state the user had not chosen.
 *
 * The moving part is a single thumb translated across the track, so the browser
 * animates one composited transform instead of three colour transitions racing
 * each other — and the whole thing is a `radiogroup`, because these are three
 * exclusive choices rather than three independent toggles. Motion is timed on
 * `--noto-duration-normal`, which a reduced-motion preference has already set
 * to zero: the thumb then simply appears under the chosen mode.
 */
export function ThemeToggle({ value, onChange, size = 'md', className }: ThemeToggleProps) {
  const index = Math.max(
    0,
    OPTIONS.findIndex((option) => option.value === value),
  );

  const compact = size === 'sm';
  const cell = compact ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        'border-default bg-surface-secondary relative inline-flex items-center rounded-full border p-0.5',
        className,
      )}
    >
      {/*
       * The thumb. It is a sibling of the buttons rather than a background on
       * the active one, which is what lets it travel between them; `left` is
       * fixed at the track's padding and the distance is a transform, so the
       * animation never touches layout.
       */}
      <span
        aria-hidden="true"
        className={cn(
          'bg-surface pointer-events-none absolute top-0.5 left-0.5 rounded-full shadow-sm',
          'transition-transform ease-out',
          cell,
        )}
        style={{
          transform: `translateX(${index * 100}%)`,
          transitionDuration: 'var(--noto-duration-normal)',
        }}
      />

      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        const Glyph = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${option.label} appearance`}
            title={`${option.label} appearance`}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center rounded-full',
              'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-1',
              'transition-colors',
              cell,
              isActive ? 'text-brand-strong' : 'text-tertiary hover:text-primary',
            )}
          >
            {/*
             * The glyph lifts very slightly as it becomes the chosen one. It is
             * the smallest amount of movement that still reads as a response to
             * the click rather than a redraw.
             */}
            <Glyph
              className={cn(
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                'transition-transform ease-out',
                isActive ? 'scale-110' : 'scale-100',
              )}
              style={{ transitionDuration: 'var(--noto-duration-normal)' }}
            />
          </button>
        );
      })}
    </div>
  );
}
