import { cn } from '../utils/cn';
import { AlertIcon, CheckIcon, CloudOffIcon, DotIcon, SyncIcon } from './icons';

export type StatusKind = 'saved' | 'pending' | 'busy' | 'offline' | 'error';

export interface StatusIndicatorProps {
  status: StatusKind;
  /** Overrides the default wording, e.g. "Synced" instead of "Saved". */
  label?: string;
  className?: string;
}

/**
 * Whether the user's work is safe.
 *
 * Noto is local-first, so this is the one piece of chrome that must never be
 * ambiguous — and never shouty: offline is a normal state, not an interruption.
 * Each status carries a glyph as well as a colour, because colour alone is not
 * something every reader can act on.
 */
const STATUS: Record<StatusKind, { label: string; className: string; spin?: boolean }> = {
  saved: { label: 'Saved', className: 'text-success' },
  pending: { label: 'Unsaved changes', className: 'text-tertiary' },
  busy: { label: 'Saving…', className: 'text-tertiary', spin: true },
  offline: { label: 'Offline • Changes saved locally', className: 'text-warning' },
  error: { label: 'Save failed', className: 'text-danger' },
};

const GLYPH = {
  saved: CheckIcon,
  pending: DotIcon,
  busy: SyncIcon,
  offline: CloudOffIcon,
  error: AlertIcon,
} as const;

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const preset = STATUS[status];
  const Glyph = GLYPH[status];

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1.5 whitespace-nowrap',
        preset.className,
        className,
      )}
      // The editor announces its own save state; a busy spinner announcing
      // itself every keystroke would talk over the writer.
      aria-live="polite"
    >
      <Glyph className={cn('h-3.5 w-3.5 shrink-0', preset.spin && 'animate-spin')} />
      {label ?? preset.label}
    </span>
  );
}
