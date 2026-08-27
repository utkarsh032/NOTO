import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '../utils/cn';
import { fieldClasses } from './field-styles';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Renders a label above the field and ties it to the input. */
  label?: string;
  /** Sits under the field. Shown in the error tone when `invalid` is set. */
  hint?: ReactNode;
  invalid?: boolean;
  fieldSize?: 'sm' | 'md';
  /** A search glyph, for instance. Inset at the leading edge. */
  leading?: ReactNode;
}

export function Input({
  label,
  hint,
  invalid = false,
  fieldSize = 'md',
  leading,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  const field = (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={hintId}
      className={cn(fieldClasses(fieldSize, invalid), leading && 'pl-9', className)}
      {...props}
    />
  );

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-primary text-body-sm font-medium">
          {label}
        </label>
      ) : null}

      {leading ? (
        <div className="relative">
          <span
            className="text-tertiary pointer-events-none absolute inset-y-0 left-3 flex items-center"
            aria-hidden="true"
          >
            {leading}
          </span>
          {field}
        </div>
      ) : (
        field
      )}

      {hint ? (
        <p id={hintId} className={cn('text-caption', invalid ? 'text-danger' : 'text-tertiary')}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  fieldSize?: 'sm' | 'md';
}

/** A native select wearing the same field styling, so a form row stays level. */
export function Select({ fieldSize = 'md', className, ...props }: SelectProps) {
  return <select className={cn(fieldClasses(fieldSize), className)} {...props} />;
}
