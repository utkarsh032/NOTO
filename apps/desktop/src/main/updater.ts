/**
 * Desktop auto-update.
 *
 * Noto points Electron's built-in `autoUpdater` at `update.electronjs.org` —
 * the free service Electron operates for public GitHub repositories that
 * publish their builds to GitHub Releases. No update server of Noto's own is
 * involved. The feed URL shape is that service's documented one:
 * `https://update.electronjs.org/:owner/:repo/:platform-:arch/:version`.
 *
 * Three constraints shape everything here:
 *
 *   1. `autoUpdater` supports Windows and macOS only. Linux updates go through
 *      the AppImage or the distribution's package manager instead.
 *   2. `update.electronjs.org` serves whatever GitHub marks as the latest
 *      release, which by definition is the stable channel. Beta and nightly
 *      therefore need a static feed, configured through the environment, and
 *      stay opt-in until one exists.
 *   3. `autoUpdater` has no "look, but do not fetch": finding an update starts
 *      downloading it. So the choice Noto offers is not whether to download but
 *      whether to *apply* — which is why nothing here restarts anything. The
 *      renderer asks, and the answer comes back through `install`.
 *
 * This module deliberately keeps no schedule of its own. When to look is a
 * setting the user owns, it is stored with the rest of their settings in the
 * renderer, and one timer in one place is what keeps desktop and web behaving
 * the same way.
 */

import {
  APP_NAME,
  DEFAULT_UPDATE_CHANNEL,
  GITHUB_SLUG,
  UPDATE_SERVICE_URL,
  type UpdateChannel,
} from '@noto/config';
import { app, autoUpdater } from 'electron';

import type { UpdateReport } from '../shared/channels';
import { BUILD_CHANNEL, UPDATE_FEED_URL } from '../generated/environment';

const CHANNELS: readonly UpdateChannel[] = ['stable', 'beta', 'nightly'];

/** How long a check waits for the feed before giving up on it. */
const CHECK_TIMEOUT_MS = 30_000;

/**
 * Why this build cannot update itself, or `null` when it can.
 *
 * Set once, at startup. Every entry point reads it rather than re-deriving the
 * answer, so the renderer is told the same thing whichever way it asks.
 */
let unsupportedReason: string | null = 'Update checking has not started yet.';

/** Pushes a status change to the window. Set by `registerUpdateHandlers`. */
let publish: (report: UpdateReport) => void = () => {};

function log(message: string): void {
  // eslint-disable-next-line no-console -- the main process has no other sink before a window exists
  console.log(`[updater] ${message}`);
}

function resolveChannel(): UpdateChannel {
  // The channel baked in at package time is the authority: a packaged app
  // inherits none of the environment that built it. The variable stays ahead of
  // it only so a developer or a CI job can retarget a build without repackaging.
  const requested = process.env.NOTO_UPDATE_CHANNEL || BUILD_CHANNEL;
  if (requested && (CHANNELS as readonly string[]).includes(requested)) {
    return requested as UpdateChannel;
  }
  if (requested) log(`ignoring unknown update channel "${requested}"`);
  return DEFAULT_UPDATE_CHANNEL;
}

/** Lets `update.electronjs.org` see which build is asking, as its docs ask. */
function userAgent(): string {
  return `${APP_NAME}/${app.getVersion()} (${process.platform}: ${process.arch})`;
}

/** Installs the sink status changes are pushed through. */
export function setUpdatePublisher(next: (report: UpdateReport) => void): void {
  publish = next;
}

/**
 * Points the updater at its feed and starts relaying what it finds.
 *
 * Safe to call unconditionally: every case in which updating cannot work
 * records a reason and returns rather than throwing, so a development run or a
 * Linux build is unaffected — and the renderer is told why the buttons are not
 * there rather than being left to guess.
 */
export function initialiseUpdates(): void {
  // In development there is no packaged application to replace, and the
  // Squirrel/ZIP update payloads do not exist.
  if (!app.isPackaged) {
    unsupportedReason = 'Development builds are not updated — they are rebuilt.';
    log('skipped: not a packaged build');
    return;
  }

  if (process.platform === 'linux') {
    unsupportedReason =
      'Linux builds update through the AppImage or your package manager, not through Noto.';
    log('skipped: Electron autoUpdater does not support Linux');
    return;
  }

  const channel = resolveChannel();

  // A static feed hosts the channel's own RELEASES/zip payloads. Until one is
  // published, only stable can update itself.
  const staticFeed = process.env.NOTO_UPDATE_FEED_URL || UPDATE_FEED_URL;

  if (channel !== 'stable' && !staticFeed) {
    unsupportedReason = `The ${channel} channel has no update feed yet. Install a new build manually, or switch back to stable.`;
    log(
      `skipped: the ${channel} channel has no update feed. Build with an -Environment whose ` +
        'updateFeedUrl is set, or override with NOTO_UPDATE_FEED_URL.',
    );
    return;
  }

  const feedUrl =
    channel === 'stable'
      ? `${UPDATE_SERVICE_URL}/${GITHUB_SLUG}/${process.platform}-${process.arch}/${app.getVersion()}`
      : `${staticFeed}/${channel}/${process.platform}/${process.arch}`;

  try {
    autoUpdater.setFeedURL({ url: feedUrl, headers: { 'User-Agent': userAgent() } });
  } catch (error) {
    // An unsigned macOS build is the usual cause, and it is not a fault worth
    // taking Noto down over — it just cannot update itself.
    unsupportedReason = `This build cannot update itself: ${
      error instanceof Error ? error.message : String(error)
    }`;
    log(unsupportedReason);
    return;
  }

  unsupportedReason = null;

  /*
   * Relayed, not acted on. `autoUpdater` starts downloading as soon as it finds
   * a release, so `update-available` is reported as a download in progress
   * rather than as an offer — the offer comes when the file is on disk.
   */
  autoUpdater.on('update-available', () => {
    log('an update was found and is downloading');
    publish({ state: 'downloading' });
  });

  autoUpdater.on('update-not-available', () => {
    publish({ state: 'up-to-date' });
  });

  autoUpdater.on('update-downloaded', (_event, _notes, releaseName, releaseDate) => {
    log(`update ${releaseName} downloaded and ready`);
    publish({
      state: 'ready',
      version: releaseName?.replace(/^v/, '') ?? null,
      publishedAt: releaseDate instanceof Date ? releaseDate.toISOString() : null,
    });
  });

  autoUpdater.on('error', (error) => {
    // A failed update check must never stop Noto from working.
    log(`update check failed: ${error.message}`);
    publish({ state: 'error', message: error.message });
  });

  log(`watching the ${channel} channel — ${feedUrl}`);
}

/**
 * Looks for a newer release, resolving once the feed has answered.
 *
 * The answer is also pushed through {@link setUpdatePublisher}, because the
 * download that follows an `update-available` finishes long after this promise
 * has settled. The timeout exists so a feed that never replies leaves the
 * button spinning for half a minute rather than forever.
 */
export function checkForUpdates(): Promise<UpdateReport> {
  if (unsupportedReason) {
    return Promise.resolve({ state: 'unsupported', message: unsupportedReason });
  }

  return new Promise<UpdateReport>((resolve) => {
    let settled = false;

    const finish = (report: UpdateReport) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      autoUpdater.off('update-available', onAvailable);
      autoUpdater.off('update-not-available', onNotAvailable);
      autoUpdater.off('error', onError);
      resolve(report);
    };

    const onAvailable = () => finish({ state: 'downloading' });
    const onNotAvailable = () => finish({ state: 'up-to-date' });
    const onError = (error: Error) => finish({ state: 'error', message: error.message });

    const timer = setTimeout(
      () => finish({ state: 'error', message: 'The update service did not respond.' }),
      CHECK_TIMEOUT_MS,
    );

    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);

    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      finish({
        state: 'error',
        message: error instanceof Error ? error.message : 'The update check did not start.',
      });
    }
  });
}

/**
 * Restarts into the downloaded update.
 *
 * Only ever called because someone pressed the button that says so. Squirrel
 * would apply the update at the next launch anyway; this is the way to have it
 * now rather than a second mechanism.
 */
export function installUpdate(): void {
  log('restarting to install the update');
  autoUpdater.quitAndInstall();
}
