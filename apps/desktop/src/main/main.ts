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

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: layout.sidebarMinWidth + 480,
    minHeight: 480,
    title: APP_NAME,
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
