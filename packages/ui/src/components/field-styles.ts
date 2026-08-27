import { cn } from '../utils/cn';

/**
 * The shared field appearance: 40px tall, 8px radius, and a focus state that is
 * a brand border plus a soft ring rather than a thick outline.
 *
 * `sm` exists for toolbars and inline prompts, where a 40px field would push
 * the controls around it out of alignment.
 *
 * It lives outside `Input.tsx` because a module that exports both a component
 * and a helper cannot be hot-reloaded.
 */
export function fieldClasses(size: 'sm' | 'md' = 'md', invalid = false): string {
  return cn(
    'bg-surface text-primary placeholder:text-disabled w-full rounded-md border transition-colors',
    'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
    'disabled:bg-surface-tertiary',
    size === 'sm' ? 'h-8 px-2 text-body-sm' : 'h-10 px-3 text-body',
    invalid
      ? 'border-danger focus-visible:border-danger focus-visible:ring-danger/25 focus-visible:ring-3'
      : 'border-default hover:border-strong focus-visible:border-brand focus-visible:ring-brand-muted focus-visible:ring-3',
  );
}
