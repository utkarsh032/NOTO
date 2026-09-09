import { contextBridge, ipcRenderer } from 'electron';

import {
  DOCK_CHANNELS,
  FILE_CHANNELS,
  SHELL_CHANNELS,
  SQL_CHANNELS,
  UPDATER_CHANNELS,
  type DockPlacementReport,
  type OpenedFileReport,
  type ReadReport,
  type SavedFileReport,
  type UpdateReport,
  type WriteReport,
} from '../shared/channels';

/**
 * The renderer's entire privileged surface: two SQL calls, a print request, the
 * three halves of updating, and the dock's window controls.
 * The shared query layer in `@noto/database/sqlite` runs on the renderer side
 * and sends statements through here.
 */
const notoSql = {
  execute: (sql: string, params: unknown[]): Promise<void> =>
    ipcRenderer.invoke(SQL_CHANNELS.execute, sql, params) as Promise<void>,

  select: (sql: string, params: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke(SQL_CHANNELS.select, sql, params) as Promise<unknown[]>,
};

/** Desktop capabilities the shared shell asks for by name. */
const notoShell = {
  print: (): Promise<{ printed: boolean; reason?: string }> =>
    ipcRenderer.invoke(SHELL_CHANNELS.print) as Promise<{ printed: boolean; reason?: string }>,

  /**
   * Commands raised outside the window — a global accelerator, a tray menu.
   *
   * What arrives is a command id the shared shell already has a handler for, so
   * a key pressed while another application had focus runs exactly the same
   * code as the same key pressed inside Noto.
   */
  onCommand: (listener: (commandId: string, argument?: string) => void): (() => void) => {
    const handler = (_event: unknown, commandId: string, argument?: string) =>
      listener(commandId, argument);
    ipcRenderer.on(SHELL_CHANNELS.command, handler);
    return () => ipcRenderer.off(SHELL_CHANNELS.command, handler);
  },

  /**
   * Opens a URL in the user's own browser. Answers whether it was allowed.
   *
   * The main process refuses anything that is not `https:`, so a caller cannot
   * assume this happened — which is why it reports back rather than returning
   * nothing.
   */
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(SHELL_CHANNELS.openExternal, url) as Promise<boolean>,
};

/**
 * Files on the user's disk.
 *
 * Four calls, and every one of them either ends in one of the operating
 * system's own dialogs or names a path that came out of one. The renderer
 * never chooses a path for itself — `main/files.ts` refuses a read or a write
 * to any it did not hand out.
 */
const notoFiles = {
  /** Resolves `null` when the dialog was dismissed. */
  open: (): Promise<OpenedFileReport[] | null> =>
    ipcRenderer.invoke(FILE_CHANNELS.open) as Promise<OpenedFileReport[] | null>,

  /** Chooses where to save. Resolves `null` when dismissed; nothing is written yet. */
  saveAs: (suggestedName: string): Promise<SavedFileReport | null> =>
    ipcRenderer.invoke(FILE_CHANNELS.saveAs, suggestedName) as Promise<SavedFileReport | null>,

  /** Reads a path a dialog produced, for reopening it from Recent. */
  read: (path: string): Promise<ReadReport> =>
    ipcRenderer.invoke(FILE_CHANNELS.read, path) as Promise<ReadReport>,

  /** Writes to a path a dialog produced. Answers whether it landed, and why not. */
  write: (path: string, contents: string): Promise<WriteReport> =>
    ipcRenderer.invoke(FILE_CHANNELS.write, path, contents) as Promise<WriteReport>,
};

/**
 * The dock's controls over its own window.
 *
 * Everything here is something a renderer cannot do for itself: resize between
 * the handle and the panel, move to the other edge, follow the cursor, or bring
 * the application window back. A drag is two calls and no coordinates — see
 * `main/dock.ts` for why the pointer is followed on the other side.
 */
const notoDock = {
  setExpanded: (expanded: boolean): Promise<void> =>
    ipcRenderer.invoke(DOCK_CHANNELS.setExpanded, expanded) as Promise<void>,

  setSide: (side: 'left' | 'right'): Promise<void> =>
    ipcRenderer.invoke(DOCK_CHANNELS.setSide, side) as Promise<void>,

  dragStart: (): Promise<void> => ipcRenderer.invoke(DOCK_CHANNELS.dragStart) as Promise<void>,
  /** Resolves true when the press moved the dock, false when it was a click. */
  dragEnd: (): Promise<boolean> => ipcRenderer.invoke(DOCK_CHANNELS.dragEnd) as Promise<boolean>,

  /** `commandId` runs in the application window once it is up. */
  openApp: (commandId?: string, argument?: string): Promise<void> =>
    ipcRenderer.invoke(DOCK_CHANNELS.openApp, commandId, argument) as Promise<void>,
  hide: (): Promise<void> => ipcRenderer.invoke(DOCK_CHANNELS.hide) as Promise<void>,

  onPlacement: (listener: (placement: DockPlacementReport) => void): (() => void) => {
    const handler = (_event: unknown, placement: DockPlacementReport) => listener(placement);
    ipcRenderer.on(DOCK_CHANNELS.placement, handler);
    return () => ipcRenderer.off(DOCK_CHANNELS.placement, handler);
  },
};

/**
 * Updating. `onStatus` is a push in the bridge: a download finishes whenever it
 * finishes, and there is no request left open to answer.
 *
 * The listener is wrapped rather than handed the IPC event, so nothing from the
 * main process's side of the boundary — a sender, a port — reaches renderer
 * code that only wanted to know a version number.
 */
const notoUpdates = {
  check: (): Promise<UpdateReport> =>
    ipcRenderer.invoke(UPDATER_CHANNELS.check) as Promise<UpdateReport>,

  install: (): Promise<void> => ipcRenderer.invoke(UPDATER_CHANNELS.install) as Promise<void>,

  onStatus: (listener: (report: UpdateReport) => void): (() => void) => {
    const handler = (_event: unknown, report: UpdateReport) => listener(report);
    ipcRenderer.on(UPDATER_CHANNELS.status, handler);
    return () => ipcRenderer.off(UPDATER_CHANNELS.status, handler);
  },
};

contextBridge.exposeInMainWorld('notoSql', notoSql);
contextBridge.exposeInMainWorld('notoShell', notoShell);
contextBridge.exposeInMainWorld('notoFiles', notoFiles);
contextBridge.exposeInMainWorld('notoDock', notoDock);
contextBridge.exposeInMainWorld('notoUpdates', notoUpdates);

export type NotoSqlBridge = typeof notoSql;
export type NotoShellBridge = typeof notoShell;
export type NotoFilesBridge = typeof notoFiles;
export type NotoDockBridge = typeof notoDock;
export type NotoUpdatesBridge = typeof notoUpdates;
