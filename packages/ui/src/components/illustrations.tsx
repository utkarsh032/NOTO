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

/**
 * The Home greeting illustration: an open notebook, a pen, a cup and a plant.
 *
 * The one place in Noto that carries colour for its own sake, and even here it
 * is the brand ramp read from the theme rather than a palette of its own — so
 * it follows the dark theme instead of glowing on it. Soft shapes, thin lines,
 * no outline around the whole scene: it should read as a watermark beside the
 * greeting, not as a picture the eye has to stop at.
 */
export function HomeHeroIllustration({ className = 'h-40 w-64', ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 200"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* The wash behind the scene, at the opacity the design system reserves
          for decoration: present, never competing with the text beside it. */}
      <ellipse cx="168" cy="120" rx="132" ry="66" fill="var(--noto-brand-soft)" />
      <circle cx="70" cy="52" r="26" fill="var(--noto-brand-muted)" opacity="0.55" />

      {/* Notebook, open, with a page of writing on it. */}
      <g stroke="var(--noto-brand-strong)" strokeWidth="2.5" strokeLinejoin="round">
        <path
          d="M60 148c22-14 46-14 68 0V78c-22-14-46-14-68 0Z"
          fill="var(--noto-surface)"
          opacity="0.95"
        />
        <path
          d="M128 148c22-14 46-14 68 0V78c-22-14-46-14-68 0Z"
          fill="var(--noto-surface)"
          opacity="0.95"
        />
        <path d="M128 78v70" />
      </g>
      <g stroke="var(--noto-brand)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
        <path d="M76 98h36" />
        <path d="M76 110h36" />
        <path d="M76 122h24" />
        <path d="M144 98h36" />
        <path d="M144 110h28" />
      </g>

      {/* The pen, nib down, resting over the right-hand page. */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M196 60l16-16a9 9 0 0 1 13 13l-16 16Z"
          fill="var(--noto-brand)"
          stroke="var(--noto-brand-strong)"
          strokeWidth="2.5"
        />
        <path
          d="M196 60 179 77l-5 18 18-5 17-17Z"
          fill="var(--noto-brand-muted)"
          stroke="var(--noto-brand-strong)"
          strokeWidth="2.5"
        />
        <path d="m174 95 7-7" stroke="var(--noto-brand-strong)" strokeWidth="2.5" />
      </g>

      {/* Cup of coffee, with steam. */}
      <g stroke="var(--noto-brand-strong)" strokeWidth="2.5" strokeLinecap="round">
        <path
          d="M228 108h44v22a18 18 0 0 1-18 18h-8a18 18 0 0 1-18-18Z"
          fill="var(--noto-brand)"
          strokeLinejoin="round"
        />
        <path d="M272 114h6a9 9 0 0 1 0 18h-6" strokeLinejoin="round" />
        <path d="M240 96c0-5 5-5 5-10s-5-5-5-10" opacity="0.5" />
        <path d="M256 96c0-5 5-5 5-10s-5-5-5-10" opacity="0.5" />
      </g>

      {/* Plant in a pot. */}
      <g stroke="var(--noto-brand-strong)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M292 148V116" />
        <path
          d="M292 122c-14 0-20-8-20-18 12 0 20 6 20 18Z"
          fill="var(--noto-brand-muted)"
          strokeLinejoin="round"
        />
        <path
          d="M292 130c14 0 20-8 20-18-12 0-20 6-20 18Z"
          fill="var(--noto-brand-subtle)"
          strokeLinejoin="round"
        />
        <path
          d="M278 148h28l-3 18a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4Z"
          fill="var(--noto-brand-soft)"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** A note and a pen, for the sidebar's Quick Note card. */
export function QuickNoteIllustration({ className = 'h-12 w-12', ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect
        x="12"
        y="10"
        width="34"
        height="44"
        rx="4"
        fill="var(--noto-surface)"
        stroke="var(--noto-brand-strong)"
        strokeWidth="2.5"
      />
      <g stroke="var(--noto-brand)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
        <path d="M20 22h18" />
        <path d="M20 30h18" />
        <path d="M20 38h11" />
      </g>
      <path
        d="M40 40 52 28a5 5 0 0 1 7 7L47 47l-9 2Z"
        fill="var(--noto-brand-muted)"
        stroke="var(--noto-brand-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A magnifier over layered cards, for an empty search or memory result. */
export function SearchIllustration({ className = 'h-12 w-12', ...props }: IllustrationProps) {
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
      <rect x="18" y="20" width="42" height="52" rx="4" />
      <path d="M30 34h18" />
      <path d="M30 44h12" />
      <circle cx="60" cy="56" r="14" />
      <path d="m70 66 10 10" />
    </svg>
  );
}
