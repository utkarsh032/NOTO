/**
 * Desktop auto-update.
 *
 * Noto uses Electron's built-in `autoUpdater` through `update-electron-app`,
 * pointed at `update.electronjs.org` — the free service Electron operates for
 * public GitHub repositories that publish their builds to GitHub Releases. No
 * update server of Noto's own is involved.
 *
 * Two constraints shape everything here:
 *
 *   1. `autoUpdater` supports Windows and macOS only. Linux updates go through
 *      the AppImage or the distribution's package manager instead.
 *   2. `update.electronjs.org` serves whatever GitHub marks as the latest
 *      release, which by definition is the stable channel. Beta and nightly
 *      therefore need a static feed, configured through the environment, and
 *      stay opt-in until one exists.
 */

import {
  DEFAULT_UPDATE_CHANNEL,
  GITHUB_SLUG,
  UPDATE_SERVICE_URL,
  type UpdateChannel,
} from '@noto/config';
import { app } from 'electron';
import { UpdateSourceType, updateElectronApp } from 'update-electron-app';

/** How long Noto waits between update checks while it is running. */
const UPDATE_INTERVAL = '2 hours';

const CHANNELS: readonly UpdateChannel[] = ['stable', 'beta', 'nightly'];

function log(message: string): void {
  // eslint-disable-next-line no-console -- the main process has no other sink before a window exists
  console.log(`[updater] ${message}`);
}

function resolveChannel(): UpdateChannel {
  const requested = process.env.NOTO_UPDATE_CHANNEL;
  if (requested && (CHANNELS as readonly string[]).includes(requested)) {
    return requested as UpdateChannel;
  }
  if (requested) log(`ignoring unknown update channel "${requested}"`);
  return DEFAULT_UPDATE_CHANNEL;
}

/**
 * Starts background update checking. Safe to call unconditionally: every case
 * in which updating cannot work returns early with an explanation rather than
 * throwing, so a development run or a Linux build is unaffected.
 */
export function initialiseUpdates(): void {
  // In development there is no packaged application to replace, and the
  // Squirrel/ZIP update payloads do not exist.
  if (!app.isPackaged) {
    log('skipped: not a packaged build');
    return;
  }

  if (process.platform === 'linux') {
    log(
      'skipped: Electron autoUpdater does not support Linux — update via AppImage or your package manager',
    );
    return;
  }

  const channel = resolveChannel();

  // A static feed hosts the channel's own RELEASES/zip payloads. Until one is
  // published, only stable can update itself.
  const staticFeed = process.env.NOTO_UPDATE_FEED_URL;

  if (channel !== 'stable' && !staticFeed) {
    log(
      `skipped: the ${channel} channel needs NOTO_UPDATE_FEED_URL to point at its update feed. ` +
        'Install a new build manually, or switch back to stable.',
    );
    return;
  }

  try {
    updateElectronApp({
      updateSource:
        channel === 'stable'
          ? {
              type: UpdateSourceType.ElectronPublicUpdateService,
              repo: GITHUB_SLUG,
              host: UPDATE_SERVICE_URL,
            }
          : {
              type: UpdateSourceType.StaticStorage,
              baseUrl: `${staticFeed}/${channel}/${process.platform}/${process.arch}`,
            },
      updateInterval: UPDATE_INTERVAL,
      // Shows the "a new version is ready, restart to apply" dialog rather than
      // restarting under the user while they are writing.
      notifyUser: true,
      logger: { log, info: log, error: log, warn: log },
    });

    log(`watching the ${channel} channel for updates every ${UPDATE_INTERVAL}`);
  } catch (error) {
    // A failed update check must never stop Noto from opening.
    log(
      `could not start update checking: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
