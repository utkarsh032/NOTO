import fs from 'node:fs';
import path from 'node:path';

import { BrowserWindow, app, ipcMain, screen } from 'electron';

import { DOCK_CHANNELS, type DockPlacementReport } from '../shared/channels';

/**
 * The Quick Note dock.
 *
 * A second window, and the only part of Noto that is meant to outlive the
 * application window: a 44px tab stuck to the edge of a display, always on top,
 * absent from the taskbar and the alt-tab list, which opens into a narrow panel
 * with a note field in it.
 *
 * It exists because the useful moment for a quick note is almost never a moment
 * when Noto is what you are looking at. Minimise the window, close it, work in
 * something else — the tab is still there, and the thought goes into the same
 * draft the application has open.
 *
 * All of this has to live in the main process. A renderer cannot resize its own
 * window between two shapes, cannot move it to another display, and — during a
 * drag — cannot know where on the desktop the pointer actually is: inside a
 * 44px window, `clientX` is a number between 0 and 44 whichever monitor it is
 * over. So the renderer reports gestures and the main process does the moving.
 */

type DockSide = 'left' | 'right';

/** The tab, and what it opens into. Both are fixed: the dock is not resizable. */
const HANDLE_SIZE = { width: 44, height: 96 } as const;
const PANEL_SIZE = { width: 340, height: 540 } as const;

interface DockState {
  side: DockSide;
  /** How far down the display's work area, 0 to 1. */
  offset: number;
  /** The display the dock was last left on. */
  displayId: number | null;
  /** Whether the user pinned it out permanently, rather than it following the window. */
  pinned: boolean;
}

const DEFAULT_STATE: DockState = { side: 'right', offset: 0.55, displayId: null, pinned: false };

let state: DockState = { ...DEFAULT_STATE };
let dockWindow: BrowserWindow | null = null;
let expanded = false;

/**
 * Whether losing focus should put the panel away.
 *
 * Armed only once the panel has actually held the keyboard. `focus()` on an
 * always-on-top window is a request rather than a guarantee, and a blur
 * arriving before the window ever had focus would close the panel in the same
 * gesture that opened it.
 */
let dismissArmed = false;

/** The timer that follows the cursor while the dock is being dragged. */
let dragTimer: NodeJS.Timeout | null = null;

/** How the dock window is loaded. Supplied by `main.ts`, which owns the Vite constants. */
type DockLoader = (window: BrowserWindow) => void;
let loadDock: DockLoader = () => {};

/**
 * Brings the application window back, optionally running a command in it.
 *
 * The dock's Paste, Search and Ask AI are all "do this, but in the real
 * window": there is no palette or AI panel inside a 340px tab, and building a
 * second one there would be a second one to keep in step. Supplied by
 * `main.ts`, which owns the window.
 */
let openApplication: (commandId?: string, argument?: string) => void = () => {};

/* -------------------------------------------------------------------------- */
/* Where it was left                                                          */
/* -------------------------------------------------------------------------- */

/*
 * The placement is a file in the user data directory rather than something in
 * the renderer's local storage. It is read before any window exists — the dock
 * has to be created at the right size on the right edge, not created wrong and
 * corrected a frame later — and the main process is the only side awake then.
 */
function stateFile(): string {
  return path.join(app.getPath('userData'), 'dock.json');
}

function readState(): DockState {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as Partial<DockState>;

    return {
      side: parsed.side === 'left' ? 'left' : 'right',
      offset: clampOffset(Number(parsed.offset)),
      displayId: typeof parsed.displayId === 'number' ? parsed.displayId : null,
      pinned: parsed.pinned === true,
    };
  } catch {
    // No file yet, or an unreadable one. Either way the default is correct.
    return { ...DEFAULT_STATE };
  }
}

function writeState(): void {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state), 'utf8');
  } catch {
    // The dock still works; it just will not remember where it was.
  }
}

function clampOffset(offset: number): number {
  if (!Number.isFinite(offset)) return DEFAULT_STATE.offset;
  return Math.min(0.95, Math.max(0.02, offset));
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

/** The display the dock belongs to: the one it was left on, or the primary. */
function targetDisplay(): Electron.Display {
  const displays = screen.getAllDisplays();
  const remembered = displays.find((display) => display.id === state.displayId);
  return remembered ?? screen.getPrimaryDisplay();
}

/**
 * Where the window goes, in screen coordinates.
 *
 * `workArea` rather than `bounds`, so the dock sits above the taskbar instead
 * of under it, and the vertical position is clamped into that area: a fraction
 * remembered on a tall monitor must still land on screen on a short one.
 */
function boundsFor(display: Electron.Display): Electron.Rectangle {
  const size = expanded ? PANEL_SIZE : HANDLE_SIZE;
  const area = display.workArea;

  const x = state.side === 'right' ? area.x + area.width - size.width : area.x;
  const wanted = area.y + Math.round(state.offset * area.height) - Math.round(size.height / 2);
  const y = Math.min(Math.max(wanted, area.y), area.y + area.height - size.height);

  return { x, y, width: size.width, height: size.height };
}

function applyBounds(): void {
  if (!dockWindow || dockWindow.isDestroyed()) return;
  dockWindow.setBounds(boundsFor(targetDisplay()));
}

/** Tells the dock's renderer which way round it is, so it can draw itself. */
function publishPlacement(): void {
  if (!dockWindow || dockWindow.isDestroyed()) return;

  const report: DockPlacementReport = { side: state.side, expanded };
  dockWindow.webContents.send(DOCK_CHANNELS.placement, report);
}

/* -------------------------------------------------------------------------- */
/* The window                                                                 */
/* -------------------------------------------------------------------------- */

function createDockWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...boundsFor(targetDisplay()),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    /*
     * Moving is the main process's job. Left movable, a stray drag on the
     * panel's chrome would slide the window out from under the placement this
     * module thinks it has.
     */
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // The panel has a field in it, so the window has to be able to take the
    // keyboard. What keeps it from stealing focus is how it is *shown*:
    // `showInactive` for the handle, and `show` only when the panel opens.
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Above ordinary windows, and above full-screen ones: a dock that disappears
  // behind the thing you are taking a note about is not a dock.
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadDock(window);

  /* A freshly loaded dock knows nothing about itself; this is the first
     thing it is told, and the only reason the handle is not drawn on the
     wrong edge for a frame after a reload. */
  window.webContents.on('did-finish-load', () => publishPlacement());

  /* A panel that has been focused is a panel a later blur may close. */
  window.on('focus', () => {
    if (expanded) dismissArmed = true;
  });

  /*
   * Clicking anything else puts the panel away.
   *
   * The dock is always on top, absent from the taskbar and absent from
   * alt-tab, so nothing about the desktop tells you it is still open: left
   * out, it simply sits over whatever you moved on to. Not while dragging —
   * the window can lose focus as it is thrown across a display boundary — and
   * not before it has ever been focused.
   */
  window.on('blur', () => {
    if (!expanded || !dismissArmed || drag) return;
    collapseDock();
  });

  window.on('closed', () => {
    dockWindow = null;
    expanded = false;
    dismissArmed = false;
  });

  return window;
}

function ensureWindow(): BrowserWindow {
  if (!dockWindow || dockWindow.isDestroyed()) dockWindow = createDockWindow();
  return dockWindow;
}

/* -------------------------------------------------------------------------- */
/* The public surface                                                         */
/* -------------------------------------------------------------------------- */

export interface DockOptions {
  /** Loads the dock route into the window. */
  load: DockLoader;
  /**
   * Brings the application window forward, from the dock's own buttons.
   *
   * `commandId` is a shared-shell command to run once it is up.
   */
  openApplication(commandId?: string, argument?: string): void;
}

export function initialiseDock(options: DockOptions): void {
  loadDock = options.load;
  openApplication = options.openApplication;
  state = readState();

  registerDockHandlers();
}

/** Whether the user asked for the dock to stay out whatever the window does. */
export function isDockPinned(): boolean {
  return state.pinned;
}

export function setDockPinned(pinned: boolean): void {
  state.pinned = pinned;
  writeState();

  if (pinned) showDock();
  else hideDock();
}

export function isDockVisible(): boolean {
  return Boolean(dockWindow && !dockWindow.isDestroyed() && dockWindow.isVisible());
}

/**
 * Shows the dock as a handle.
 *
 * `showInactive` rather than `show`: the dock appearing because Noto was
 * minimised must not steal focus from whatever the user minimised Noto to get
 * to. Opening the panel is the one case that does take focus, because the point
 * of it is a field to type into.
 */
export function showDock(): void {
  const window = ensureWindow();

  collapseDock();
  if (!window.isVisible()) window.showInactive();
}

/** Puts the dock away. Pinned, it stays: the user asked for it explicitly. */
export function hideDock(options: { force?: boolean } = {}): void {
  if (state.pinned && !options.force) return;
  if (!dockWindow || dockWindow.isDestroyed()) return;

  expanded = false;
  dismissArmed = false;
  dockWindow.hide();
}

/**
 * Shrinks the panel back to the handle, leaving the dock where it is.
 *
 * The one way out of the panel, whether it was Escape, the close button or a
 * click on something else entirely — so there is a single place that keeps the
 * window's size, the renderer's idea of itself and the dismissal arming in
 * step with each other.
 */
function collapseDock(): void {
  if (!expanded) return;

  expanded = false;
  dismissArmed = false;
  applyBounds();
  publishPlacement();
}

/** Shows the dock with its panel already open, focused, ready for a keystroke. */
export function openDockPanel(): void {
  const window = ensureWindow();

  expanded = true;
  dismissArmed = false;
  applyBounds();
  publishPlacement();

  window.show();
  window.focus();

  /* Already had the keyboard — clicking the handle focuses the window before
     it is asked to grow — so no `focus` event is coming to arm the dismissal. */
  if (window.isFocused()) dismissArmed = true;
}

export function destroyDock(): void {
  endDrag();
  if (dockWindow && !dockWindow.isDestroyed()) dockWindow.destroy();
  dockWindow = null;
}

/* -------------------------------------------------------------------------- */
/* Dragging                                                                   */
/* -------------------------------------------------------------------------- */

/** Roughly one frame. The dock is 44px wide; it does not need 240Hz. */
const DRAG_INTERVAL_MS = 16;

/**
 * How far the cursor has to travel before a press counts as a drag.
 *
 * Every press moves the mouse a pixel or two, and without a threshold each one
 * started the window chasing the cursor: the tab jumped out from under the
 * very click that was opening it, and the placement was rewritten to disk for
 * a gesture that never asked to move anything. Below this the dock stays
 * exactly where it was found.
 */
const DRAG_START_PX = 6;

/**
 * Nothing should hold the cursor forever if a pointer-up is somehow missed —
 * a crashed renderer, a display disconnected mid-drag.
 */
const DRAG_TIMEOUT_MS = 30_000;

/** The press in progress, from the moment it goes down to the moment it lifts. */
let drag: {
  /** Where the cursor was when the press began, to measure travel against. */
  origin: Electron.Point;
  /** How far below the window's top edge it was grabbed. */
  grabY: number;
  /** Whether it has travelled far enough to have stopped being a click. */
  moved: boolean;
} | null = null;

/**
 * Follows the system cursor until the drag ends.
 *
 * A timer rather than a message per pointer move, because there are no pointer
 * moves to listen to: the window is being placed *under* the cursor, so the
 * cursor does not move relative to it and the renderer is sent nothing. The
 * only reliable source of the pointer position during this gesture is the
 * system, and only the main process can ask it.
 */
function startDrag(): void {
  endDrag();
  if (!dockWindow || dockWindow.isDestroyed()) return;

  const origin = screen.getCursorScreenPoint();
  const bounds = dockWindow.getBounds();
  const startedAt = Date.now();

  drag = {
    origin,
    /* Clamped into the window: a press can be captured from just outside its
       edge, and a grab point off the dock would offset every later move. */
    grabY: Math.min(Math.max(origin.y - bounds.y, 0), bounds.height),
    moved: false,
  };

  dragTimer = setInterval(() => {
    if (!drag || Date.now() - startedAt > DRAG_TIMEOUT_MS) {
      endDrag();
      return;
    }

    const point = screen.getCursorScreenPoint();

    if (!drag.moved) {
      const travelled = Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y);
      if (travelled < DRAG_START_PX) return;
      drag.moved = true;
    }

    const display = screen.getDisplayNearestPoint(point);
    const area = display.workArea;
    const height = (expanded ? PANEL_SIZE : HANDLE_SIZE).height;

    /* Whichever display the pointer is over is the display the dock is on,
       which is what makes it draggable to a second monitor. */
    state.displayId = display.id;
    /* And whichever half of that display it is in decides the edge, so the
       dock snaps as the gesture is made rather than after it is finished. */
    state.side = point.x < area.x + area.width / 2 ? 'left' : 'right';

    /*
     * The point that was grabbed stays under the cursor. Centring on the
     * cursor instead — which is what a bare `point.y` does — makes a 540px
     * panel taken by its header leap a quarter of a screen downwards the
     * instant it moves, and a 96px handle jump by up to half its height.
     */
    const top = point.y - drag.grabY;
    const settled = Math.min(Math.max(top, area.y), area.y + area.height - height);
    state.offset = clampOffset((settled + height / 2 - area.y) / area.height);

    applyBounds();
    publishPlacement();
  }, DRAG_INTERVAL_MS);
}

/**
 * Ends the press, and reports whether it turned out to be a drag.
 *
 * The renderer asks, because it cannot tell: the window follows the cursor, so
 * from in there a drag across three monitors and a click that never moved look
 * exactly alike.
 */
function endDrag(): boolean {
  const moved = drag?.moved === true;

  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }

  drag = null;
  /* Only a gesture that moved something has anything to remember. */
  if (moved) writeState();

  return moved;
}

/* -------------------------------------------------------------------------- */
/* Messages from the dock's renderer                                          */
/* -------------------------------------------------------------------------- */

function registerDockHandlers(): void {
  ipcMain.handle(DOCK_CHANNELS.setExpanded, (_event, next: boolean) => {
    /* Growing into the panel is a request to type into it, which is exactly
       what `openDockPanel` does; shrinking is the one collapse path. */
    if (next === true) openDockPanel();
    else collapseDock();
  });

  ipcMain.handle(DOCK_CHANNELS.setSide, (_event, side: DockSide) => {
    state.side = side === 'left' ? 'left' : 'right';
    applyBounds();
    publishPlacement();
    writeState();
  });

  ipcMain.handle(DOCK_CHANNELS.dragStart, () => startDrag());
  /* The answer is what the renderer tells a click from a drag by. */
  ipcMain.handle(DOCK_CHANNELS.dragEnd, () => endDrag());

  ipcMain.handle(DOCK_CHANNELS.openApp, (_event, commandId?: string, argument?: string) => {
    openApplication(commandId, argument);
    hideDock();
  });

  ipcMain.handle(DOCK_CHANNELS.hide, () => {
    /* Dismissing the dock by hand turns the pin off; otherwise it would come
       straight back and look broken. */
    state.pinned = false;
    writeState();
    hideDock({ force: true });
  });
}
