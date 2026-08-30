import { cn } from '../utils/cn';

export interface ToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  /** The accessible name. Required — a switch with no name says nothing. */
  label: string;
  /** Hides the visible label; the control keeps its accessible name. */
  hideLabel?: boolean;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A switch.
 *
 * Used for settings that take effect immediately; anything that needs saving
 * gets a checkbox and a Save button instead, because a switch that has not
 * applied yet is a lie about the state of the application.
 */
export function Toggle({
  checked,
  onChange,
  label,
  hideLabel = false,
  description,
  disabled = false,
  className,
}: ToggleProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {hideLabel ? null : (
        <span className="min-w-0 flex-1">
          <span className="text-primary text-body-sm block font-medium">{label}</span>
          {description ? (
            <span className="text-tertiary text-caption block">{description}</span>
          ) : null}
        </span>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:ring-brand focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-40',
          checked ? 'bg-brand' : 'bg-strong',
        )}
      >
        {/*
         * The knob carries a shadow rather than a border so it stays legible
         * against both track colours, and it moves rather than appearing:
         * the travel is what tells the eye which way the switch just went.
         */}
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
