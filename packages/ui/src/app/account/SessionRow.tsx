import type { Session } from '@noto/types';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LaptopIcon, MonitorIcon, PhoneIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { formatDateTime, relativeTime } from '../../utils/format';

export interface SessionRowProps {
  session: Session;
  onSignOut(): void;
}

const GLYPH = {
  desktop: LaptopIcon,
  web: MonitorIcon,
  mobile: PhoneIcon,
} as const;

/**
 * One place Noto is signed in.
 *
 * The current session is shown but cannot be ended from here: signing yourself
 * out belongs in the account menu, where you expect it, not on a row that looks
 * like the three above it.
 */
export function SessionRow({ session, onSignOut }: SessionRowProps) {
  const Glyph = GLYPH[session.kind];

  return (
    <li className="border-default flex items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          session.isCurrent
            ? 'bg-brand-soft text-brand-hover'
            : 'bg-surface-tertiary text-tertiary',
        )}
      >
        <Glyph className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-primary text-body-sm font-medium">{session.client}</p>
          {session.isCurrent ? <Badge tone="brand">Current Session</Badge> : null}
        </div>
        <p className="text-tertiary text-caption mt-0.5">
          {session.location ?? 'Unknown location'} · started {formatDateTime(session.startedAt)}
        </p>
      </div>

      <p className="text-tertiary text-caption hidden shrink-0 sm:block">
        {relativeTime(session.lastActiveAt)}
      </p>

      <Button size="sm" variant="ghost" onClick={onSignOut} disabled={session.isCurrent}>
        Sign out
      </Button>
    </li>
  );
}
