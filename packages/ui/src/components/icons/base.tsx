import type { ReactNode, SVGProps } from 'react';

/**
 * Noto's icon set.
 *
 * One family throughout, in the Lucide manner the design system asks for: the
 * same 24×24 grid, the same 1.75px stroke, the same round caps and joins. Noto
 * has no icon dependency, and one pulled in for thirty glyphs would ship a few
 * hundred more.
 *
 * Every icon inherits `currentColor`, so a button styles its icon by styling
 * itself, and takes its size from `className` — 20px standard, 16px compact,
 * 24px for feature icons.
 *
 * This file holds the shared props and the `<svg>` wrapper every glyph is drawn
 * in; the glyphs themselves live beside it, grouped by where Noto uses them,
 * and `index.ts` gathers them into the one set the package exports.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

export function Icon({
  className = 'h-4 w-4',
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Every icon here sits inside a button that carries its own label.
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}
