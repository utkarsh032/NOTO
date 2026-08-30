import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../utils/cn';
import { CloseIcon, SearchIcon } from './icons';

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'onChange' | 'value'
> {
  value: string;
  onValueChange(value: string): void;
  /** The accessible name; also the placeholder unless one is given. */
  label: string;
  /** A shortcut chip or a filter control, pinned to the trailing edge. */
  trailing?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'h-9 pl-9 pr-3 text-body-sm',
  md: 'h-10 pl-10 pr-3 text-body',
  lg: 'h-12 pl-11 pr-3 text-body-lg',
};

/**
 * The search field, everywhere it appears.
 *
 * Type `search` so the platform treats it as one, but the browser's own clear
 * button is suppressed in the stylesheet's favour: Chrome's is invisible in the
 * dark theme, and a control that vanishes with the theme is worse than none.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onValueChange, label, trailing, inputSize = 'md', className, ...props },
  ref,
) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <SearchIcon
        className={cn(
          'text-tertiary pointer-events-none absolute left-3 h-4 w-4',
          inputSize === 'lg' && 'left-4 h-5 w-5',
        )}
      />

      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label={label}
        placeholder={props.placeholder ?? label}
        className={cn(
          'bg-surface border-default text-primary placeholder:text-disabled w-full rounded-md border transition-colors',
          'hover:border-strong focus-visible:border-brand focus-visible:ring-brand-muted focus-visible:ring-3 focus-visible:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
          SIZE[inputSize],
          (trailing || value) && 'pr-20',
        )}
        {...props}
      />

      <div className="absolute right-2 flex items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label="Clear search"
            className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand flex h-6 w-6 items-center justify-center rounded-sm transition-colors focus-visible:outline-2"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {trailing}
      </div>
    </div>
  );
});
