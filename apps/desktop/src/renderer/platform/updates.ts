import { reportUpdateStatus, type UpdateProvider } from '@noto/ui';

import type { UpdateReport } from '../../shared/channels';

/**
 * Desktop updating, as the shared shell sees it.
 *
 * A thin translation and nothing more: the main process owns the feed, the
 * shell owns when to look and what to say, and this maps one vocabulary onto
 * the other. Everything the user experiences — the prompt, the "later", the
 * automatic setting — is the same code web runs.
 */

/** Turns a report from the main process into a status the shell understands. */
function applyReport(report: UpdateReport): void {
  reportUpdateStatus({
    state: report.state,
    version: report.version ?? null,
    publishedAt: report.publishedAt ?? null,
    message: report.message ?? null,
    checkedAt: Date.now(),
  });
}

export const desktopUpdateProvider: UpdateProvider = {
  installLabel: 'Restart and install',

  // Squirrel applies a downloaded update at the next launch whether or not it
  // is asked to, which is what makes "install automatically" honest here.
  appliesOnRestart: true,

  async check() {
    applyReport(await window.notoUpdates.check());
  },

  async install() {
    // Does not return: the application is replaced and relaunched.
    await window.notoUpdates.install();
  },
};

/**
 * Starts relaying update status from the main process.
 *
 * Separate from the provider because it outlives any one check: the download
 * that follows a check finishes minutes later, with nothing waiting on it.
 */
export function subscribeToUpdateStatus(): () => void {
  return window.notoUpdates.onStatus(applyReport);
}
