import path from 'node:path';

import { APP_NAME, layout } from '@noto/config';
import { BrowserWindow, app } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';

import { registerSqlHandlers } from './ipc';
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

function createWindow(): void {
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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

void app.whenReady().then(() => {
  openConnection(app.getPath('userData'));
  registerSqlHandlers();
  createWindow();
  initialiseUpdates();

  app.on('activate', () => {
    // macOS keeps the app running with no windows; re-open one on dock click.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeConnection();
});
