import { APP_NAME, APP_VERSION, RELEASES_URL } from '@noto/config';
import { useSettingsStore } from '@noto/core';

import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Toggle } from '../../../components/Toggle';
import { DownloadIcon, ExternalLinkIcon } from '../../../components/icons';
import { relativeTime } from '../../../utils/format';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import {
  checkForUpdates,
  installUpdate,
  isUpdateWaiting,
  updateCapabilities,
  useUpdateStatus,
} from '../../updates';

/** The Updates section of Settings. */
export function UpdatesSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const updatePreferences = useSettingsStore((state) => state.updateUpdatePreferences);
  const update = useUpdateStatus();
  const { installLabel, appliesOnRestart } = updateCapabilities();

  return (
    <SettingsSection
      title="Updates"
      description="How Noto finds out about new releases, and what it does about them."
    >
      <SettingsRow
        label="Current version"
        description={
          update.state === 'unsupported'
            ? (update.message ?? 'This build of Noto does not update itself.')
            : update.checkedAt
              ? `Last checked ${relativeTime(update.checkedAt).toLowerCase()}.`
              : 'Noto has not looked for a newer release yet this session.'
        }
        control={
          <div className="flex items-center gap-2">
            {isUpdateWaiting(update) ? (
              <Badge tone="brand" dot>
                {update.version} available
              </Badge>
            ) : (
              <Badge>{APP_VERSION}</Badge>
            )}
            <Button
              size="sm"
              loading={update.state === 'checking' || update.state === 'downloading'}
              onClick={() => void checkForUpdates({ manual: true })}
            >
              Check now
            </Button>
          </div>
        }
      />

      {/* Only shown when there is something to press. A permanent
          "install" button with nothing to install is furniture. */}
      {isUpdateWaiting(update) ? (
        <SettingsRow
          label={`${APP_NAME} ${update.version}`}
          description={
            update.state === 'ready'
              ? 'Downloaded and waiting. Noto restarts to finish.'
              : 'Published and ready to download.'
          }
          control={
            <Button
              variant="primary"
              size="sm"
              leading={<DownloadIcon className="h-4 w-4" />}
              onClick={() => void installUpdate()}
            >
              {installLabel}
            </Button>
          }
        />
      ) : null}

      <SettingsRow
        label="Check for updates automatically"
        description="Asks GitHub for the newest release every few hours. This is the only thing Noto sends over the network on its own — switch it off and it never looks unless you press Check now."
        control={
          <Toggle
            hideLabel
            label="Check for updates automatically"
            checked={settings.updates.checkAutomatically}
            onChange={(checked) => updatePreferences({ checkAutomatically: checked })}
          />
        }
      />

      <SettingsRow
        label="Install updates automatically"
        description={
          appliesOnRestart
            ? 'A new version is installed the next time you open Noto, without asking. Off, Noto tells you it is ready and waits for you.'
            : 'Noto in a browser cannot replace itself — reload the page to move to a new version. This is a desktop setting.'
        }
        control={
          <Toggle
            hideLabel
            label="Install updates automatically"
            disabled={!appliesOnRestart}
            checked={appliesOnRestart && settings.updates.automatic}
            onChange={(checked) => updatePreferences({ automatic: checked })}
          />
        }
      />

      <SettingsRow
        label="Release notes"
        description="Every release, what changed in it, and the files it published."
        control={
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="text-brand-strong text-body-sm focus-visible:outline-brand inline-flex items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Open on GitHub
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        }
      />
    </SettingsSection>
  );
}
