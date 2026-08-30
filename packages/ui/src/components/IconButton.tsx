import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../utils/cn';

export type IconButtonVariant = 'ghost' | 'surface' | 'brand';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** What the button does. Becomes both the accessible name and the tooltip. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Renders as a pressed toggle rather than a plain button. */
  isActive?: boolean;
}

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-tertiary hover:bg-surface-secondary hover:text-primary active:bg-surface-tertiary',
  surface:
    'border border-default bg-surface text-secondary hover:bg-surface-secondary hover:text-primary hover:border-strong',
  brand: 'bg-brand text-on-brand hover:bg-brand-hover shadow-sm',
};

/** 28/36/40px. The middle one is the default for headers and card actions. */
const SIZE: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7 rounded-sm',
  md: 'h-9 w-9 rounded-md',
  lg: 'h-10 w-10 rounded-md',
};

/**
 * A button that is only an icon.
 *
 * It always carries a label — an icon with no accessible name is a control only
 * some people can use, and the same string doubles as the tooltip that tells
 * everyone else what the glyph means.
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  isActive = false,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={isActive || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        'focus-visible:outline-brand focus-visible:outline-2 focus-visible:outline-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        // A tint rather than a fill: a row of filled icon buttons reads as a
        // toolbar of alerts.
        isActive ? 'bg-brand-soft text-brand-strong' : VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
