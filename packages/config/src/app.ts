/** Constants that must agree across web, desktop and mobile. */

export const APP_NAME = 'Noto';
export const APP_ID = 'com.noto.app';

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
