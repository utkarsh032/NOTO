import { APP_NAME, APP_VERSION } from '@noto/config';
import { useSettingsStore } from '@noto/core';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Toggle } from '../../components/Toggle';
import { DownloadIcon, ExternalLinkIcon } from '../../components/icons';
import { formatDate } from '../../utils/format';
import { dismissUpdate, installUpdate, updateCapabilities, useUpdateStatus } from '../updates';

/**
 * "A new version of Noto is ready."
 *
 * The one place Noto asks for something rather than being asked. It is shown
 * once per release — saying "Later" files that version away rather than
 * deferring it to the next launch — and it never appears while automatic
 * updates are on, because then there is nothing to decide.
 *
 * Both versions are named. "An update is available" tells the reader nothing
 * they can act on; "1.2.0 → 1.3.0, released two days ago, here are the notes"
 * is enough to decide whether to restart now or after lunch.
 */
export function UpdateDialog() {
  const status = useUpdateStatus();
  const automatic = useSettingsStore((state) => state.settings.updates.automatic);
  const updatePreferences = useSettingsStore((state) => state.updateUpdatePreferences);

  const { installLabel, appliesOnRestart } = updateCapabilities();
  const ready = status.state === 'ready';

  return (
    <Dialog
      open={status.promptOpen && status.version !== null}
      onClose={dismissUpdate}
      title={`${APP_NAME} ${status.version ?? ''} is available`}
      description={
        ready
          ? 'It has already been downloaded and is waiting to be installed.'
          : 'A newer release has been published.'
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={dismissUpdate}>
            Later
          </Button>
          <Button
            variant="primary"
            data-autofocus
            leading={<DownloadIcon className="h-5 w-5" />}
            onClick={() => void installUpdate()}
          >
            {installLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {/* The move, drawn rather than described: what is running, and what it
            would become. */}
        <p className="text-secondary text-body flex items-center gap-2">
          <span className="text-tertiary tabular-nums">{APP_VERSION}</span>
          <span aria-hidden="true">→</span>
          <span className="text-primary font-semibold tabular-nums">{status.version}</span>
          {status.publishedAt ? (
            <span className="text-tertiary text-caption">
              released {formatDate(status.publishedAt)}
            </span>
          ) : null}
        </p>

        <p className="text-secondary text-body-sm">
          {ready
            ? 'Noto will restart, and your open documents will be where you left them.'
            : `${installLabel} to move to the new version. Nothing you have written is affected.`}
        </p>

        <a
          href={status.notesUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand-strong text-body-sm focus-visible:outline-brand inline-flex items-center gap-1.5 self-start rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          What is new in {status.version}
          <ExternalLinkIcon className="h-4 w-4" />
        </a>

        {/*
         * The way out of being asked at all, offered at the moment the question
         * is being asked — which is the only moment someone knows whether they
         * want to be asked again. Hidden where it would be a lie: the browser
         * cannot install anything behind the user's back, and must not pretend
         * it will.
         */}
        {appliesOnRestart ? (
          <div className="border-default bg-surface-secondary rounded-lg border p-3">
            <Toggle
              label="Install updates automatically"
              description="Future updates are installed the next time you open Noto, without asking."
              checked={automatic}
              onChange={(checked) => updatePreferences({ automatic: checked })}
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
