import { APP_NAME, APP_VERSION } from '@noto/config';

import { Spinner } from '../components/Spinner';
import { DownloadIcon } from '../components/icons';
import { cn } from '../utils/cn';
import { checkForUpdates, isUpdateWaiting, openUpdatePrompt, useUpdateStatus } from './updates';

/**
 * The version number in the sidebar, and what happens when there is a newer one.
 *
 * The number was already there, sitting quietly at the bottom of the sidebar
 * where a version number belongs. Two things are added rather than replacing
 * it: it can now be pressed, which is where "check for updates" lives — nobody
 * goes looking for that in a menu, and everybody knows where the version is —
 * and when a release is waiting, a row appears above it saying so.
 *
 * That row stays until the update is applied, including after the prompt has
 * been dismissed with "Later". The dialog is what asks; this is what remembers,
 * so saying "not now" costs nothing and is not a decision to be talked out of.
 */

export interface SidebarUpdateProps {
  /** The 72px rail, which has room for an icon and a number and nothing else. */
  collapsed?: boolean;
}

/** The "a new version is waiting" row. Renders nothing when none is. */
export function SidebarUpdateButton({ collapsed = false }: SidebarUpdateProps) {
  const status = useUpdateStatus();
  if (!isUpdateWaiting(status)) return null;

  const label = `${APP_NAME} ${status.version} is available`;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={openUpdatePrompt}
        aria-label={label}
        title={label}
        className="bg-brand-soft text-brand-strong hover:bg-brand hover:text-on-brand focus-visible:outline-brand relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <DownloadIcon className="h-5 w-5" />
        {/* The dot repeats what the icon already means, for the glance that
            does not stop long enough to read the glyph. */}
        <span
          aria-hidden="true"
          className="bg-brand ring-surface-secondary absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openUpdatePrompt}
      className="bg-brand-soft text-brand-strong hover:bg-brand hover:text-on-brand focus-visible:outline-brand mb-2.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <DownloadIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-body-sm block font-semibold">Update to {status.version}</span>
        <span className="text-caption block opacity-80">
          {status.state === 'ready' ? 'Downloaded and ready' : 'A new version is out'}
        </span>
      </span>
    </button>
  );
}

/**
 * The version number, which is also the way to ask whether it is the current
 * one. Pressing it while an update is waiting reopens the offer instead of
 * checking again — there is nothing left to find.
 */
export function SidebarVersion({ collapsed = false }: SidebarUpdateProps) {
  const status = useUpdateStatus();
  const checking = status.state === 'checking' || status.state === 'downloading';
  const waiting = isUpdateWaiting(status);

  const title = waiting
    ? `${APP_NAME} ${status.version} is available — you have ${APP_VERSION}`
    : `${APP_NAME} ${APP_VERSION} — check for updates`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={checking}
      onClick={() => (waiting ? openUpdatePrompt() : void checkForUpdates({ manual: true }))}
      className={cn(
        'text-disabled text-caption hover:text-secondary focus-visible:outline-brand inline-flex items-center gap-1.5 rounded-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
        collapsed && 'justify-center',
      )}
    >
      {checking ? <Spinner className="h-3 w-3" /> : null}
      {APP_VERSION}
    </button>
  );
}
