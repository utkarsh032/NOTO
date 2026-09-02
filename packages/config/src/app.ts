/** Constants that must agree across web, desktop and mobile. */

import { layout } from './tokens.ts';

export const APP_NAME = 'Noto';
export const APP_ID = 'com.noto.app';

/**
 * The released product version, shown in the interface.
 *
 * Kept here rather than read from a manifest because the UI is shared by web,
 * desktop and mobile, and only one of those three can import a `package.json`
 * at build time. `pnpm version:set` rewrites this line along with the
 * manifests, and `pnpm version:check` fails the release if it ever drifts.
 */
export const APP_VERSION = '1.4.0';

/** Name of the local database on every platform (IndexedDB store / SQLite file stem). */
export const DATABASE_NAME = 'noto';

/**
 * Schema version of the local database. Bump this whenever a migration is
 * added, on every platform at once, so the stores never drift apart.
 */
export const DATABASE_VERSION = 1;

/** Keys used for lightweight key/value persistence (localStorage, AsyncStorage). */
export const STORAGE_KEYS = {
  settings: 'noto.settings',
  lastWorkspaceId: 'noto.workspace.last',
  lastDocumentId: 'noto.document.last',
  sidebarCollapsed: 'noto.ui.sidebar-collapsed',
  /** Which documents are open, in which order, and which one is in front. */
  tabs: 'noto.tabs',
  /**
   * The version the user last said "later" to, so the update prompt asks once
   * per release rather than once per launch.
   */
  dismissedUpdate: 'noto.update.dismissed',
} as const;

/**
 * Prefix for a document's recovery snapshot, completed with the document id.
 *
 * Snapshots live outside the database on purpose: the point of one is to
 * survive the process dying before the debounced write reached storage, so it
 * has to be written by something that cannot itself be mid-transaction.
 */
export const RECOVERY_KEY_PREFIX = 'noto.recovery.';

/** Name given to the offline workspace created on first launch. */
export const DEFAULT_WORKSPACE_NAME = 'My Workspace';

/** Title applied to a document that the user has not named yet. */
export const UNTITLED_DOCUMENT_TITLE = 'Untitled';

/** How long the editor waits after the last keystroke before persisting. */
export const AUTOSAVE_DELAY_MS = 600;

/** Characters of plain text kept as a document preview. */
export const EXCERPT_LENGTH = 240;

/** How many documents the recent list remembers. */
export const RECENT_DOCUMENTS_LIMIT = 10;

/**
 * The zoom steps the editor moves between.
 *
 * A fixed ladder rather than free arithmetic: repeated zooming lands on the
 * same sizes every time, and 1 is always reachable exactly.
 */
export const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

/** The zoom a document opens at. */
export const DEFAULT_ZOOM = 1;

/**
 * How far from the edge of the scroller the caret is kept, in pixels.
 *
 * The editor toolbar is sticky at the top of the same scroll container, so a
 * caret scrolled to the literal top edge lands underneath it. This is the
 * toolbar's height plus a line of breathing room, and it is applied at the
 * bottom too — typing on the last visible line should not sit on the rim.
 */
export const EDITOR_SCROLL_MARGIN = layout.toolbarHeight + 24;
