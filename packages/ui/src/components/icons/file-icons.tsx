import { Icon, type IconProps } from './base';

/* Lists, files, organisation and capture glyphs. */

/* -------------------------------------------------------------------------- */
/* Lists, files and organisation                                              */
/* -------------------------------------------------------------------------- */

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4h6l-1 5 3 3v1.5H7V12l3-3Z" />
      <path d="M12 13.5V20" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z" />
    </Icon>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4.5 6h.01" />
      <path d="M4.5 12h.01" />
      <path d="M4.5 18h.01" />
    </Icon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5h16l-6.2 7.2V19l-3.6-2v-4.3Z" />
    </Icon>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4v16" />
      <path d="m3.5 16.5 3.5 3.5 3.5-3.5" />
      <path d="M17 20V4" />
      <path d="m13.5 7.5 3.5-3.5 3.5 3.5" />
    </Icon>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3.5 6.5 2 2 3-3.5" />
      <path d="m3.5 15.5 2 2 3-3.5" />
      <path d="M12 7h8" />
      <path d="M12 16h8" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h7l9 9-7 7-9-9Z" />
      <path d="M8 8h.01" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3.5 10.5h17" />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M13 3v6h6" />
    </Icon>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v11" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </Icon>
  );
}

export function ExportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </Icon>
  );
}

/**
 * A new version, waiting. The arrow points into the tray the way `ImportIcon`
 * does, but out of a circle: an update arrives from somewhere, where an import
 * comes from a file the user chose.
 */
export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 6.5v5" />
      <path d="m9.9 9.4 2.1 2.1 2.1-2.1" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5V5.5A1.5 1.5 0 0 1 4.5 4h8A1.5 1.5 0 0 1 14 5.5V6" />
    </Icon>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
      <path d="M10 12.5h4" />
    </Icon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 8v4.2l3 1.8" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Capture                                                                    */
/* -------------------------------------------------------------------------- */

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </Icon>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 4h5v5" />
      <path d="m11 13 9-9" />
    </Icon>
  );
}
