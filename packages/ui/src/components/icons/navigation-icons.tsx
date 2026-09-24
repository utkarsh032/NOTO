import { Icon, type IconProps } from './base';

/* Navigation and direction glyphs. */

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  );
}

export function DocumentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3h6l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v4h4" />
      <path d="M18 8.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-8" />
    </Icon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Icon>
  );
}

export function FolderOpenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V11" />
      <path d="M3 8.5v9.5a2 2 0 0 0 2 2h13l3-8H6.2a2 2 0 0 0-1.9 1.4L3 18" />
    </Icon>
  );
}

/** Quick Note — a pen on a page. */
export function QuickNoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4" />
      <path d="M13 20h3l5-5a1.9 1.9 0 0 0-2.7-2.7L13 17.4Z" />
    </Icon>
  );
}

/** Noto Memory — layered recall rather than a brain. */
export function MemoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 20 7l-8 3.5L4 7Z" />
      <path d="m4 12 8 3.5 8-3.5" />
      <path d="m4 16.5 8 3.5 8-3.5" />
    </Icon>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M16 5.5h1.5A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5H8" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.6 14.4a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8 1.6 1.6 0 0 0-1.1-2.7 2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.1-2.7 2 2 0 1 1 2.8-2.8 1.6 1.6 0 0 0 2.7-1.1 2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0 1.1 2.7 2 2 0 0 1 0 4 1.6 1.6 0 0 0-1.4 1Z" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10.2 18a2 2 0 0 0 3.6 0" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Direction                                                                  */
/* -------------------------------------------------------------------------- */

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  );
}
