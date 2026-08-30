import { cn } from '../utils/cn';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  sm: 'h-7 w-7 text-caption',
  md: 'h-9 w-9 text-body-sm',
  lg: 'h-12 w-12 text-body',
  xl: 'h-20 w-20 text-h2',
};

/** First letters of the first and last words — "Aman Kumar" becomes "AK". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';

  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';

  return (first + last).toUpperCase();
}

/**
 * A person, as a picture or as their initials.
 *
 * The fallback is not decorative: most Noto accounts are local and have no
 * photograph, so the initials are what the control normally looks like and they
 * get the brand tint rather than a grey circle.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          'border-default shrink-0 rounded-full border object-cover',
          SIZE[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-brand-muted text-brand-strong inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZE[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
