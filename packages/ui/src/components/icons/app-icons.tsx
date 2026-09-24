import { Icon, type IconProps } from './base';

/* AI, devices, account, security and system glyphs. */

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

export function SparklesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 4.5 12.6 9l4.4 1.6-4.4 1.6L11 16.6 9.4 12.2 5 10.6 9.4 9Z" />
      <path d="M18 4v3" />
      <path d="M19.5 5.5h-3" />
      <path d="M17.5 16v2.5" />
      <path d="M18.75 17.25h-2.5" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 4 3.5 10.5l6.5 2.5 2.5 6.5Z" />
      <path d="m10 13 10-9" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Devices, account and security                                              */
/* -------------------------------------------------------------------------- */

export function LaptopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="10.5" rx="1.5" />
      <path d="M2 19h20" />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  );
}

export function TabletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6Z" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Icon>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01" />
      <path d="M10 10h.01" />
      <path d="M13.5 10h.01" />
      <path d="M17 10h.01" />
      <path d="M8 14h8" />
    </Icon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16 6 12l4-4" />
      <path d="M6 12h9" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c4-4.4 6-7.6 6-10a6 6 0 1 0-12 0c0 2.4 2 5.6 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </Icon>
  );
}

/* -------------------------------------------------------------------------- */
/* Status and system                                                          */
/* -------------------------------------------------------------------------- */

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9.5a2.3 2.3 0 1 1 3 2.2c-.5.2-.8.7-.8 1.3v.5" />
      <path d="M12 16.5h.01" />
    </Icon>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.3 10a3.8 3.8 0 0 1 .2 8.5Z" />
    </Icon>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </Icon>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.6 2.5-3 2.5h-1.4a2 2 0 0 0-1.4 3.4c.4.4.3 1.1-.2 1.4a4 4 0 0 1-2.5.7Z" />
      <path d="M7.5 11h.01" />
      <path d="M10 7.5h.01" />
      <path d="M14.5 7.5h.01" />
    </Icon>
  );
}

export function TypeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5V5h16v1.5" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </Icon>
  );
}

export function MaximizeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </Icon>
  );
}

export function MinimizeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" />
      <path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4" />
      <path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />
      <path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
    </Icon>
  );
}

export function PanelRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M15 4.5v15" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2.5" />
      <path d="m3.5 7.5 7.34 5.12a2 2 0 0 0 2.32 0L20.5 7.5" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.9 5.7A8.9 8.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.72" />
      <path d="M6.4 7.7A17.3 17.3 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.8-.83" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3.5 3.5 17 17" />
    </Icon>
  );
}

/** The drag affordance on the Quick Note dock: six dots, the desktop idiom. */
export function GripIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={2.25}>
      <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
    </Icon>
  );
}

/** Basic: the plan everyone starts on. */
export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 20.5A8.5 8.5 0 0 1 19.5 4c1 0 1.5.5 1.5 1.5A15.5 15.5 0 0 1 5.5 21C4.5 21 4 20.5 4 19.5c0-3 2-5 5-5" />
      <path d="M4.5 20.5 13 12" />
    </Icon>
  );
}

/** Pro: the plan the pricing page recommends. */
export function RocketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 3.5c3.5-1 6 .5 7 1 .5 1 2 3.5 1 7-1 3.4-4.2 6-6.6 7.4L9 15.1C10.4 12.7 13 9.6 16.4 8.6" />
      <path d="M9.5 14.5 6 18l-1.5-1.5L8 13" />
      <path d="M15.5 8.5h.01" />
      <path d="M6.5 17.5c-1 1-1.5 3-1.5 3s2-.5 3-1.5" />
    </Icon>
  );
}

/** Pro Max: the top of the ladder. */
export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7.5 6.5 11 12 4.5 17.5 11 21 7.5 19.5 18h-15L3 7.5Z" />
      <path d="M4.5 20.5h15" />
    </Icon>
  );
}

/** Speed, in the sense a feature list means it. */
export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 2.5 4.5 13.5h6L10.5 21.5l9-11h-6l.5-8Z" />
    </Icon>
  );
}
