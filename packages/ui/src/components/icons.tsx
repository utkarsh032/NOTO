import type { ReactNode, SVGProps } from 'react';

/**
 * The icons the editor toolbar draws with.
 *
 * Noto has no icon dependency, and one pulled in for seventeen glyphs would
 * ship a few hundred more. They are drawn on the same 24×24 grid with the same
 * stroke weight, and inherit `currentColor`, so a button styles its icon by
 * styling itself.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ className = 'h-4 w-4', children, ...props }: IconProps & { children: ReactNode }) {
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

export function BoldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4h7a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h8a4 4 0 0 1 0 8H6z" />
    </Icon>
  );
}

export function ItalicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 4h-9" />
      <path d="M14 20H5" />
      <path d="m15 4-6 16" />
    </Icon>
  );
}

export function UnderlineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M4 20h16" />
    </Icon>
  );
}

export function StrikethroughIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <path d="M4 12h16" />
    </Icon>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </Icon>
  );
}

export function CodeBlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M10 9.5 8 12l2 2.5" />
      <path d="m14 9.5 2 2.5-2 2.5" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function BulletListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </Icon>
  );
}

export function OrderedListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 6h11" />
      <path d="M10 12h11" />
      <path d="M10 18h11" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </Icon>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 6H3" />
      <path d="M21 12H8" />
      <path d="M21 18H8" />
      <path d="M3 12v6" />
    </Icon>
  );
}

export function AlignLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 6H3" />
      <path d="M15 12H3" />
      <path d="M17 18H3" />
    </Icon>
  );
}

export function AlignCenterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 6H3" />
      <path d="M17 12H7" />
      <path d="M19 18H5" />
    </Icon>
  );
}

export function AlignRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 6H3" />
      <path d="M21 12H9" />
      <path d="M21 18H7" />
    </Icon>
  );
}

export function AlignJustifyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 6H3" />
      <path d="M21 12H3" />
      <path d="M21 18H3" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </Icon>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M12 3v18" />
    </Icon>
  );
}

export function DividerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h16" />
    </Icon>
  );
}

export function ClearFormattingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7V4h16v3" />
      <path d="M5 20h6" />
      <path d="M13 4 8 20" />
      <path d="m15 15 5 5" />
      <path d="m20 15-5 5" />
    </Icon>
  );
}
