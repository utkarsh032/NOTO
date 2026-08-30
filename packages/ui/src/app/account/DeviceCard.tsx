import type { Device } from '@noto/types';

import { Badge } from '../../components/Badge';
import { Dropdown } from '../../components/Dropdown';
import {
  LaptopIcon,
  LogOutIcon,
  MapPinIcon,
  MonitorIcon,
  MoreIcon,
  PhoneIcon,
  TabletIcon,
  TrashIcon,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';

export interface DeviceCardProps {
  device: Device;
  onSignOut(): void;
  onRemove(): void;
}

/**
 * The glyph that matches the machine, so the list is scanned by shape.
 *
 * It returns the element rather than the component: picking a component type
 * while rendering and then calling it is how a subtree ends up remounting on
 * every render, and React's rules of components say not to.
 */
function deviceGlyph(device: Device, className: string) {
  if (device.platform === 'ios' && device.name.toLowerCase().includes('ipad')) {
    return <TabletIcon className={className} />;
  }

  switch (device.platform) {
    case 'ios':
    case 'android':
      return <PhoneIcon className={className} />;
    case 'macos':
      return <LaptopIcon className={className} />;
    default:
      return <MonitorIcon className={className} />;
  }
}

/**
 * One device with Noto installed.
 *
 * The current one is marked and cannot be removed from itself — an action that
 * would sign you out of the window you are looking at, from a menu in that
 * window, is a trap rather than a feature.
 */
export function DeviceCard({ device, onSignOut, onRemove }: DeviceCardProps) {
  return (
    <li
      className={cn(
        'border-default bg-surface flex items-start gap-3.5 rounded-xl border p-4',
        device.isCurrent && 'border-brand-subtle bg-brand-soft/40',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          device.isCurrent
            ? 'bg-brand-muted text-brand-strong'
            : 'bg-surface-tertiary text-tertiary',
        )}
      >
        {deviceGlyph(device, 'h-5 w-5')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-primary text-body-sm font-semibold">{device.name}</h3>
          {device.isCurrent ? <Badge tone="brand">This Device</Badge> : null}
        </div>

        <p className="text-tertiary text-caption mt-0.5">
          {device.osName} · Noto {device.appVersion}
        </p>

        <p className="text-tertiary text-caption mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {device.location ? (
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-3.5 w-3.5" />
              {device.location}
            </span>
          ) : null}
          <span aria-hidden="true">•</span>
          <span>Active {relativeTime(device.lastActiveAt)}</span>
        </p>
      </div>

      <Dropdown
        label={`Actions for ${device.name}`}
        items={[
          {
            id: 'sign-out',
            label: 'Sign out of this device',
            icon: <LogOutIcon className="h-4 w-4" />,
            disabled: device.isCurrent,
            onSelect: onSignOut,
          },
          {
            id: 'remove',
            label: 'Remove device',
            icon: <TrashIcon className="h-4 w-4" />,
            danger: true,
            disabled: device.isCurrent,
            separated: true,
            onSelect: onRemove,
          },
        ]}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={`Actions for ${device.name}`}
            className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
          >
            <MoreIcon className="h-5 w-5" />
          </button>
        )}
      />
    </li>
  );
}
