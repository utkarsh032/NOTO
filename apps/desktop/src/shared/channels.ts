/**
 * IPC channel names shared by the main process and the preload script.
 *
 * This module exists so the preload bundle can name the channels without
 * importing the main-process SQLite module: preload runs in the sandboxed
 * renderer, where `node:sqlite` does not exist and the import would fail.
 */
export const SQL_CHANNELS = {
  execute: 'noto:sql:execute',
  select: 'noto:sql:select',
} as const;

/**
 * Capabilities the shared shell asks the desktop for. Print is the first: the
 * renderer has no print preview of its own inside Electron, so the job is
 * handed to the main process, which hands it to the operating system.
 *
 * `command` goes the other way. Quick Note and Quick Paste are registered as
 * *global* accelerators — they fire while another application has the keyboard,
 * which is the whole point of them — so the key press is seen by the main
 * process and the window has to be told about it. What travels is a command id
 * the shared shell already knows, not a key.
 */
export const SHELL_CHANNELS = {
  print: 'noto:shell:print',
  command: 'noto:shell:command',
} as const;

/**
 * The Quick Note dock.
 *
 * The dock is its own frameless, always-on-top window, so most of what it does
 * is something only the main process can do: resize itself between a handle and
 * a panel, move to the other edge of the display, follow the cursor during a
 * drag, and bring the application window back.
 *
 * Dragging is two messages and no coordinates at all. It cannot be anything
 * else: while the dock is being dragged the window is following the pointer,
 * so the pointer is not moving *relative to the window* and the renderer stops
 * being sent pointer moves altogether. The renderer therefore says only when
 * the drag starts and when it ends, and the main process follows the system
 * cursor in between — which is also the only side that knows where on the
 * desktop, across how many displays, that cursor actually is.
 */
export const DOCK_CHANNELS = {
  /** Renderer → main: grow to the panel, or shrink back to the handle. */
  setExpanded: 'noto:dock:set-expanded',
  /** Renderer → main: put the dock on this edge of the display. */
  setSide: 'noto:dock:set-side',
  dragStart: 'noto:dock:drag-start',
  dragEnd: 'noto:dock:drag-end',
  /** Renderer → main: bring the application window forward, and optionally run a command in it. */
  openApp: 'noto:dock:open-app',
  /** Renderer → main: put the dock away until it is asked for again. */
  hide: 'noto:dock:hide',
  /** Main → dock renderer: where the dock is now, and how big. */
  placement: 'noto:dock:placement',
} as const;

/** What the main process tells the dock window about itself. */
export interface DockPlacementReport {
  side: 'left' | 'right';
  expanded: boolean;
}

/**
 * Updating.
 *
 * `check` and `install` are asked for by the renderer; `status` goes the other
 * way, because Electron's `autoUpdater` reports on its own schedule — it starts
 * downloading the moment it finds something, and finishes whenever the download
 * finishes. A request/response pair cannot express that, so the main process
 * pushes each change to whichever window is open.
 */
export const UPDATER_CHANNELS = {
  check: 'noto:update:check',
  install: 'noto:update:install',
  status: 'noto:update:status',
} as const;

/**
 * What the main process says about an update, in the shared shell's own terms.
 *
 * `downloading` is where an Electron update spends most of its life: the
 * updater fetches as soon as it finds something, so there is no moment at which
 * a desktop update is merely "available".
 */
export interface UpdateReport {
  state: 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'unsupported' | 'error';
  /** The release found, without its `v`. */
  version?: string | null;
  /** ISO 8601 publication timestamp, when the feed gave one. */
  publishedAt?: string | null;
  /** Why it failed, or why this build cannot update itself. */
  message?: string | null;
}
