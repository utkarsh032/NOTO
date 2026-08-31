/**
 * Knowing when a newer Noto exists, and doing something about it.
 *
 * Three things are kept apart here, because three platforms answer them
 * differently:
 *
 *   - *Finding out.* Every platform can ask GitHub what the newest release is
 *     and compare it with the version this build was made from. That is the
 *     default provider, and it is all web has.
 *   - *Fetching.* Only desktop can do this. Electron's `autoUpdater` downloads
 *     the new build in the background and reports when it is on disk.
 *   - *Applying.* Desktop restarts into the new version; web reloads the page.
 *     Neither happens without being asked, unless the user has said in Settings
 *     that it may.
 *
 * The store is a module store rather than a context, for the same reason the
 * toasts are: it is written to from a preload bridge, an interval and three
 * different buttons, and there is only ever one update state per window.
 */

import {
  APP_VERSION,
  LATEST_RELEASE_API_URL,
  LATEST_RELEASE_URL,
  STORAGE_KEYS,
  UPDATE_CHECK_INTERVAL_MS,
} from '@noto/config';
import { isNewerVersion, useSettingsStore } from '@noto/core';
import { useEffect, useSyncExternalStore } from 'react';

import { showToast } from '../components/toast-store';

/**
 * Where the update sits.
 *
 * `available` and `ready` are the two that mean something is waiting: the first
 * is a release the user has to fetch themselves, the second one Noto already
 * holds and can apply. `unsupported` is a build that cannot update itself — a
 * Linux package, or a development run — and says so rather than offering a
 * button that would do nothing.
 */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'unsupported'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  /** The version found, when one was. Never the version already running. */
  version: string | null;
  /** ISO 8601 publication timestamp, when the source gave one. */
  publishedAt: string | null;
  /** Where the release notes are. */
  notesUrl: string;
  /** Why the check failed, or why this build cannot update itself. */
  message: string | null;
  /** When the last check finished, as a timestamp. */
  checkedAt: number | null;
  /** Whether the update prompt is on screen. */
  promptOpen: boolean;
}

const INITIAL: UpdateStatus = {
  state: 'idle',
  version: null,
  publishedAt: null,
  notesUrl: LATEST_RELEASE_URL,
  message: null,
  checkedAt: null,
  promptOpen: false,
};

/**
 * What a platform has to supply to take over updating.
 *
 * Deliberately small: the provider finds and applies, and reports what happened
 * through {@link reportUpdateStatus}. Everything about when to ask, what to
 * show and what the user has already declined stays here, so desktop and web
 * cannot drift into behaving differently.
 */
export interface UpdateProvider {
  /** How the action that applies the update is labelled. */
  installLabel: string;
  /**
   * True when Noto applies the update itself on its next start. This is what
   * makes "install updates automatically" mean anything — web can only reload,
   * and never does that unasked.
   */
  appliesOnRestart: boolean;
  /** Looks for a newer release, reporting the outcome. */
  check(): Promise<void>;
  /** Applies whatever was found. May not return: desktop restarts. */
  install(): Promise<void>;
}

/** How long after opening Noto the first background check runs. */
const FIRST_CHECK_DELAY_MS = 4000;

let status: UpdateStatus = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Merges a patch into the current status. Providers report through this. */
export function reportUpdateStatus(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch };
  emit();
}

/* ── What the user has already declined ─────────────────────────────────── */

/*
 * Kept in storage rather than in the status, because "I saw this one and said
 * later" has to survive the window closing. Without it, an update prompt is a
 * thing that reappears every launch until you give in, which is how a helpful
 * message turns into an advertisement.
 */

function readDismissed(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.dismissedUpdate);
  } catch {
    return null;
  }
}

function writeDismissed(version: string | null): void {
  try {
    if (version) localStorage.setItem(STORAGE_KEYS.dismissedUpdate, version);
    else localStorage.removeItem(STORAGE_KEYS.dismissedUpdate);
  } catch {
    // Storage being unavailable means the prompt asks again. That is the
    // harmless direction to fail in.
  }
}

/** True when the user has already said "later" to this version, or a newer one. */
export function isUpdateDismissed(version: string | null): boolean {
  if (!version) return false;
  const dismissed = readDismissed();
  // Compared by version rather than by equality, so a release newer than the
  // one that was declined asks again.
  return dismissed !== null && !isNewerVersion(version, dismissed);
}

/* ── The provider ───────────────────────────────────────────────────────── */

/**
 * Asking GitHub, which is what every platform falls back to.
 *
 * It can only ever reach `available`: a browser cannot replace the application
 * it is running, so the offer is to read the release notes and to reload —
 * which on web is genuinely how a new build arrives.
 */
const githubProvider: UpdateProvider = {
  installLabel: 'Reload Noto',
  appliesOnRestart: false,

  async check() {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    // 404 is "nothing released yet" and 403 is "rate limited". Neither is
    // something to put in front of someone who is writing.
    if (!response.ok) {
      reportUpdateStatus({
        state: 'up-to-date',
        checkedAt: Date.now(),
        message:
          response.status === 403
            ? 'GitHub is rate-limiting update checks from this network. Try again later.'
            : null,
      });
      return;
    }

    const release = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
      published_at?: string;
    };

    const version = release.tag_name?.replace(/^v/, '') ?? null;

    if (!version || !isNewerVersion(version, APP_VERSION)) {
      reportUpdateStatus({ state: 'up-to-date', version: null, checkedAt: Date.now() });
      return;
    }

    reportUpdateStatus({
      state: 'available',
      version,
      publishedAt: release.published_at ?? null,
      notesUrl: release.html_url ?? LATEST_RELEASE_URL,
      message: null,
      checkedAt: Date.now(),
    });
  },

  async install() {
    // A reload is the whole update on web: the new build is already served.
    window.location.reload();
  },
};

let provider: UpdateProvider = githubProvider;

/**
 * Installs the platform's updater, replacing the GitHub one.
 *
 * Registered at startup the way the print handler is. Passing `null` puts the
 * default back, which is what a desktop build does when it unmounts.
 */
export function setUpdateProvider(next: UpdateProvider | null): void {
  provider = next ?? githubProvider;
}

/** What the current provider can do, for the interface to label itself with. */
export function updateCapabilities(): Pick<UpdateProvider, 'installLabel' | 'appliesOnRestart'> {
  return { installLabel: provider.installLabel, appliesOnRestart: provider.appliesOnRestart };
}

/* ── Actions ────────────────────────────────────────────────────────────── */

export interface CheckOptions {
  /**
   * The user pressed a button. A manual check says so when there is nothing to
   * report, and clears an earlier "later" — someone who goes looking for an
   * update wants to be shown the one they declined last week.
   */
  manual?: boolean;
}

/** Looks for a newer release. Never throws: a failed check is a status. */
export async function checkForUpdates({ manual = false }: CheckOptions = {}): Promise<void> {
  if (status.state === 'checking' || status.state === 'downloading') return;

  // A build that cannot update itself has nothing to check.
  if (status.state === 'unsupported') {
    if (manual && status.message) showToast(status.message);
    return;
  }

  // Nothing to look for while the update is already in hand.
  if (status.state === 'ready') {
    if (manual) openUpdatePrompt();
    return;
  }

  if (manual) writeDismissed(null);
  reportUpdateStatus({ state: 'checking', message: null });

  try {
    await provider.check();
  } catch (error) {
    reportUpdateStatus({
      state: 'error',
      checkedAt: Date.now(),
      message: error instanceof Error ? error.message : 'The update check did not complete.',
    });
  }

  if (!manual) return;

  /*
   * Read back through the accessor rather than returned by `check`, because the
   * provider is what reported the outcome — and on desktop it arrives from the
   * main process rather than from the promise that has just settled.
   */
  const outcome = snapshot();

  if (outcome.state === 'up-to-date') {
    showToast(`Noto ${APP_VERSION} is the latest version.`, { tone: 'success' });
  } else if (outcome.state === 'error') {
    showToast(outcome.message ?? 'Noto could not check for updates.', { tone: 'error' });
  } else if (outcome.state === 'unsupported') {
    showToast(outcome.message ?? 'This build of Noto does not update itself.');
  } else if (outcome.state === 'available' || outcome.state === 'ready') {
    openUpdatePrompt();
  }
}

/** Applies the update. Reports failure rather than raising it. */
export async function installUpdate(): Promise<void> {
  try {
    await provider.install();
  } catch (error) {
    reportUpdateStatus({
      state: 'error',
      promptOpen: false,
      message: error instanceof Error ? error.message : 'Noto could not install the update.',
    });
    showToast('Noto could not install the update.', { tone: 'error' });
  }
}

export function openUpdatePrompt(): void {
  reportUpdateStatus({ promptOpen: true });
}

/**
 * Closes the prompt without applying anything, and remembers the version so it
 * is not asked about again until there is a newer one.
 */
export function dismissUpdate(): void {
  writeDismissed(status.version);
  reportUpdateStatus({ promptOpen: false });
}

/* ── React ──────────────────────────────────────────────────────────────── */

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): UpdateStatus {
  return status;
}

export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** True when there is a version worth putting in front of the user. */
export function isUpdateWaiting(current: UpdateStatus): boolean {
  return (current.state === 'available' || current.state === 'ready') && current.version !== null;
}

/**
 * The background check, and what happens when it finds something.
 *
 * Mounted once, by the application shell. It checks shortly after Noto opens
 * rather than during the first paint — the first seconds of a launch belong to
 * the documents, not to a network request — and then on a long interval.
 *
 * What it does with a result is the whole policy: with automatic updates on and
 * a platform that can apply them, it says so once and stays out of the way;
 * otherwise it asks. Either way it says nothing about a version the user has
 * already declined.
 */
export function useUpdateWatcher(): void {
  const checkAutomatically = useSettingsStore((state) => state.settings.updates.checkAutomatically);
  const automatic = useSettingsStore((state) => state.settings.updates.automatic);
  const hydrated = useSettingsStore((state) => state.hydrated);
  const { state, version } = useUpdateStatus();

  useEffect(() => {
    // Waiting for the stored settings avoids firing a check the user switched
    // off in an earlier session, in the moment before Noto had read that.
    if (!hydrated || !checkAutomatically) return;

    const initial = setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY_MS);
    const interval = setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [hydrated, checkAutomatically]);

  useEffect(() => {
    if (state !== 'available' && state !== 'ready') return;
    if (!version || isUpdateDismissed(version)) return;

    if (automatic && updateCapabilities().appliesOnRestart) {
      /*
       * It will be applied on the next start whether or not this is read, so
       * this is a notice rather than a question — with the way to have it now
       * attached, for whoever would rather not wait.
       */
      showToast(`Noto ${version} will be installed the next time you open Noto.`, {
        id: `noto-update-${version}`,
        action: { label: 'Restart now', onSelect: () => void installUpdate() },
      });
      return;
    }

    openUpdatePrompt();
  }, [state, version, automatic]);
}
