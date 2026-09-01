import path from 'node:path';

import { APP_NAME, layout } from '@noto/config';
import { BrowserWindow, Menu, Tray, app, nativeImage } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';

import { SHELL_CHANNELS } from '../shared/channels';
import {
  destroyDock,
  hideDock,
  initialiseDock,
  isDockPinned,
  openDockPanel,
  setDockPinned,
  showDock,
} from './dock';
import { registerShellHandlers, registerSqlHandlers, registerUpdateHandlers } from './ipc';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts';
import { closeConnection, openConnection } from './sqlite';
import { initialiseUpdates } from './updater';

// The Windows Squirrel installer launches the app to create shortcuts; quit
// immediately in that case rather than flashing a window at the user.
if (squirrelStartup) app.quit();

// Injected by @electron-forge/plugin-vite.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

/**
 * Windows embeds the icon in the executable and macOS reads it from the bundle,
 * but a Linux window shows a generic placeholder unless the process names one —
 * and so does every platform during development, where there is no bundle yet.
 *
 * Packaging prunes `assets/`, so `forge.config.ts` copies the PNG next to the
 * bundle as an extra resource; from source it is still two levels above the
 * compiled main script.
 */
const WINDOW_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '..', '..', 'assets', 'icon.png');

/**
 * The application window, held rather than looked up.
 *
 * Noto now has two windows and they are not interchangeable: closing the
 * application window leaves Noto running behind the dock, so "the window" can
 * no longer mean "the one window there is".
 */
let mainWindow: BrowserWindow | null = null;

/** Set in `before-quit`, so closing the window can mean hide until it means quit. */
let isQuitting = false;

let tray: Tray | null = null;

/**
 * Noto keeps running behind the dock and the tray, so a second launch has to
 * find the first one instead of starting a rival copy on the same database.
 */
if (!app.requestSingleInstanceLock()) app.quit();

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: layout.sidebarMinWidth + 480,
    minHeight: 480,
    title: APP_NAME,
    icon: WINDOW_ICON,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // The renderer runs untrusted document content; keep it isolated and
      // without direct Node access. All storage goes through the SQL channel.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Avoids the white flash before the renderer has painted.
  window.once('ready-to-show', () => window.show());

  // Renderer console output is otherwise only visible in devtools; forwarding
  // it during development keeps `electron-forge start` a usable feedback loop.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.webContents.on('console-message', (event) => {
      // eslint-disable-next-line no-console -- forwarding to the dev terminal is the point
      console.log(`[renderer:${event.level}] ${event.message}`);
    });
  }

  /*
   * Closing the window puts Noto away rather than ending it.
   *
   * This is what makes the dock mean anything: a note you want to take at 11pm
   * is not a reason to have left a document editor open all evening. Noto stays
   * in the tray with its tab on the edge of the screen, and Quit — in the tray
   * menu — is what actually ends it.
   */
  window.on('close', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    window.hide();
    showDock();
  });

  /* The dock is the stand-in for the window: out when the window is not. */
  window.on('minimize', () => showDock());
  window.on('hide', () => showDock());
  window.on('restore', () => hideDock());
  window.on('focus', () => hideDock());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

/**
 * Brings the application window forward, creating it if it has been closed.
 *
 * Every route back into Noto goes through here — the tray, the dock's "Open
 * Noto", a second launch, the dock icon on macOS — because "show the window"
 * has four cases (missing, hidden, minimised, behind something) and getting one
 * of them wrong means a click that appears to do nothing.
 */
function openApplication(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
    return;
  }

  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

/** True when the window is up and in front — the dock stands down in that case. */
function isApplicationForeground(): boolean {
  return Boolean(
    mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized(),
  );
}

/**
 * Runs a shared-shell command inside the window, from outside it.
 *
 * Held until the renderer is up. A global Quick Note pressed while Noto was
 * closed has to create the window first, and a message posted to a page that
 * is still loading is a message nobody receives.
 */
function sendCommand(commandId: string, argument?: string): void {
  const target = mainWindow;
  if (!target || target.isDestroyed()) return;

  if (target.webContents.isLoading()) {
    target.webContents.once('did-finish-load', () => {
      if (!target.isDestroyed()) {
        target.webContents.send(SHELL_CHANNELS.command, commandId, argument);
      }
    });
    return;
  }

  target.webContents.send(SHELL_CHANNELS.command, commandId, argument);
}

/** Loads the dock route into the dock's window. Same bundle, different root. */
function loadDockWindow(window: BrowserWindow): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/dock`);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      hash: '/dock',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Tray                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The tray icon.
 *
 * It is not decoration: once closing the window stops quitting the application,
 * the tray is the thing that says Noto is still running, and the only place
 * that offers to stop it.
 */
function createTray(): void {
  const icon = nativeImage.createFromPath(WINDOW_ICON).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on('click', () => openApplication());

  refreshTrayMenu();
}

function refreshTrayMenu(): void {
  if (!tray) return;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Open ${APP_NAME}`, click: () => openApplication() },
      { label: 'Quick Note', accelerator: 'CommandOrControl+Alt+N', click: () => quickNote() },
      { type: 'separator' },
      {
        label: 'Keep the Quick Note dock on screen',
        type: 'checkbox',
        checked: isDockPinned(),
        click: (item) => {
          setDockPinned(item.checked);
          refreshTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: `Quit ${APP_NAME}`,
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

/* -------------------------------------------------------------------------- */
/* Global accelerators                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Quick Note, from anywhere.
 *
 * Which surface answers depends on where you are. With Noto in front of you the
 * floating window over the document is the right answer; with Noto minimised or
 * closed, opening the whole application to write one line is not — so the dock
 * panel opens instead, on top of whatever you were doing, with the caret in it.
 */
function quickNote(): void {
  if (isApplicationForeground()) {
    openApplication();
    sendCommand('app.quickNote');
    return;
  }

  openDockPanel();
}

function quickPaste(): void {
  if (isApplicationForeground()) {
    openApplication();
    sendCommand('app.quickPaste');
    return;
  }

  openDockPanel();
}

function toggleDock(): void {
  setDockPinned(!isDockPinned());
  refreshTrayMenu();
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

app.on('second-instance', () => openApplication());

void app.whenReady().then(() => {
  openConnection(app.getPath('userData'));
  registerSqlHandlers();
  registerShellHandlers();
  registerUpdateHandlers();

  initialiseDock({
    load: loadDockWindow,
    openApplication: (commandId, argument) => {
      openApplication();
      if (commandId) sendCommand(commandId, argument);
    },
  });

  mainWindow = createWindow();
  createTray();
  initialiseUpdates();

  registerGlobalShortcuts({
    'app.quickNote': quickNote,
    'app.quickPaste': quickPaste,
    'app.toggleDock': toggleDock,
  });

  // The dock was pinned when Noto last shut down; put it back out.
  if (isDockPinned()) showDock();

  app.on('activate', () => {
    // macOS keeps the app running with no windows; re-open one on dock click.
    openApplication();
  });
});

app.on('window-all-closed', () => {
  /*
   * Only reached once the dock has gone too — the application window hides
   * rather than closing, and the dock is a window of its own. Left as it was:
   * on macOS an application with no windows is still an application.
   */
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  unregisterGlobalShortcuts();
  destroyDock();
  tray?.destroy();
  tray = null;
  closeConnection();
});
