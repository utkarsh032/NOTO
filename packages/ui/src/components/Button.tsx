import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../utils/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label; use for icons. */
  leading?: ReactNode;
  /**
   * Swaps the leading slot for a spinner and blocks input. The label stays, so
   * the button keeps its width and the user keeps knowing what they pressed.
   */
  loading?: boolean;
}

/**
 * Every variant defines its default, hover, active and disabled appearance.
 * Designing only the resting state is how a control ends up feeling dead.
 *
 * `danger` is reserved for destructive work — delete, permanent delete, remove
 * device — and never used to mean "important".
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover shadow-sm',
  secondary:
    'bg-surface text-primary border border-default hover:bg-surface-secondary hover:border-strong active:bg-surface-tertiary',
  ghost: 'text-secondary hover:bg-surface-secondary hover:text-primary active:bg-surface-tertiary',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90 shadow-sm',
};

/** 40px is the standard control height; 32px is for dense toolbars and rows. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-body-sm font-semibold',
  md: 'h-10 gap-2 px-4 text-button',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  leading,
  loading = false,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
        // A thin ring on the brand colour rather than a thick border: visible
        // without redrawing the control's shape when it takes focus.
        'focus-visible:ring-brand focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5 border-current border-t-transparent" /> : leading}
      {children}
    </button>
  );
}
