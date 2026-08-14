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
} as const;

/** Name given to the offline workspace created on first launch. */
export const DEFAULT_WORKSPACE_NAME = 'My Workspace';

/** Title applied to a document that the user has not named yet. */
export const UNTITLED_DOCUMENT_TITLE = 'Untitled';

/** How long the editor waits after the last keystroke before persisting. */
export const AUTOSAVE_DELAY_MS = 600;

/** Characters of plain text kept as a document preview. */
export const EXCERPT_LENGTH = 240;
