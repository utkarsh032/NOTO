import { Icon, type IconProps } from './base';

/* The shell, appearance and editor status glyphs. */

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function SidebarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </Icon>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                 */
/* -------------------------------------------------------------------------- */

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
    </Icon>
  );
}

/** The "follow the system" state of the theme control. */
export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function SyncIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 0 0-14.2-4.4" />
      <path d="M4 13a8 8 0 0 0 14.2 4.4" />
      <path d="M4 4v4h4" />
      <path d="M20 20v-4h-4" />
    </Icon>
  );
}

export function CloudOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 18H7a4 4 0 0 1-.6-7.95" />
      <path d="M9.6 5.6A5.5 5.5 0 0 1 18 10h.5a3.5 3.5 0 0 1 2.4 6" />
      <path d="m3 3 18 18" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </Icon>
  );
}

/** An unsaved document: the same dot a professional editor puts on a dirty tab. */
export function DotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.1-6.4L3 9" />
    </Icon>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 7v6h-6" />
      <path d="M20.5 13a9 9 0 1 1-2.1-6.4L21 9" />
    </Icon>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </Icon>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M8 11h6" />
    </Icon>
  );
}

export function WrapTextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6h18" />
      <path d="M3 18h6" />
      <path d="M3 12h13a3 3 0 0 1 0 6h-3" />
      <path d="m15 15-2 3 2 3" />
    </Icon>
  );
}

export function PilcrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 4v16" />
      <path d="M17 4v16" />
      <path d="M19 4h-9a5 5 0 0 0 0 10h3" />
    </Icon>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function ReplaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
      <path d="M14 6h4.5a1.5 1.5 0 0 1 1.5 1.5V10" />
      <path d="m18 3 2 3-2 3" />
    </Icon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m14.5 5.5 4 4" />
    </Icon>
  );
}
