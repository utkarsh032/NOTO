import type { SVGProps } from 'react';

/**
 * Illustrations for empty and first-run states.
 *
 * Minimal, soft and editorial: a line drawing of the things writing is made of.
 * They are deliberately few — an illustration on every screen stops being a
 * welcome and starts being noise — and they draw in `currentColor` so the
 * surrounding text colour decides how quiet they are.
 */
export type IllustrationProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

/** A notebook and a pen. For "nothing here yet, start writing". */
export function WritingIllustration({ className = 'h-16 w-16', ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M24 18h34l14 14v46a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4Z" />
      <path d="M58 18v14h14" />
      <path d="M31 46h22" />
      <path d="M31 56h30" />
      <path d="M31 66h16" />
      <path d="M69 55 82 42l6 6-13 13-8 2Z" />
    </svg>
  );
}

/** A folded-back page. For a list that has nothing in it. */
export function EmptyPageIllustration({ className = 'h-12 w-12', ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M28 14h26l16 16v52H28Z" />
      <path d="M54 14v16h16" />
      <path d="M38 48h20" />
      <path d="M38 60h14" />
    </svg>
  );
}
