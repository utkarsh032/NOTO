import type { SyncStatus as SyncStatusKind } from '@noto/types';

import { cn } from '../utils/cn';
import { AlertIcon, CheckCircleIcon, CloudIcon, CloudOffIcon, SyncIcon } from './icons';

export interface SyncStatusProps {
  status: SyncStatusKind;
  /** When the last sync finished, already phrased — "Just now", "2 min ago". */
  detail?: string;
  /** `rail` is the collapsed sidebar's icon-only form. */
  variant?: 'full' | 'rail';
  className?: string;
}

const PRESET: Record<
  SyncStatusKind,
  { label: string; icon: typeof CheckCircleIcon; className: string; spin?: boolean }
> = {
  disabled: { label: 'Local only', icon: CloudIcon, className: 'text-tertiary' },
  idle: { label: 'Synced', icon: CheckCircleIcon, className: 'text-success' },
  syncing: { label: 'Syncing…', icon: SyncIcon, className: 'text-tertiary', spin: true },
  offline: { label: 'Offline', icon: CloudOffIcon, className: 'text-warning' },
  error: { label: 'Sync paused', icon: AlertIcon, className: 'text-danger' },
};

/** What each state says underneath, when nothing more specific is supplied. */
const DEFAULT_DETAIL: Record<SyncStatusKind, string> = {
  disabled: 'On this device',
  idle: 'Just now',
  syncing: 'Sending changes',
  offline: 'Changes saved locally',
  error: 'Will retry shortly',
};

/**
 * The sync footer.
 *
 * Quiet and reassuring by design: offline is a normal state for a local-first
 * application, so it is drawn in amber and phrased as where the work is, never
 * as a failure. Each state carries a glyph as well as a colour.
 */
export function SyncStatus({ status, detail, variant = 'full', className }: SyncStatusProps) {
  const preset = PRESET[status];
  const Glyph = preset.icon;
  const secondary = detail ?? DEFAULT_DETAIL[status];

  if (variant === 'rail') {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        title={`${preset.label} — ${secondary}`}
      >
        <Glyph className={cn('h-5 w-5', preset.className, preset.spin && 'animate-spin')} />
        <span className="sr-only" aria-live="polite">
          {preset.label}. {secondary}.
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-live="polite">
      <Glyph className={cn('h-5 w-5 shrink-0', preset.className, preset.spin && 'animate-spin')} />
      <span className="min-w-0">
        <span className="text-primary text-body-sm block font-medium">{preset.label}</span>
        <span className="text-tertiary text-caption block truncate">{secondary}</span>
      </span>
    </div>
  );
}
