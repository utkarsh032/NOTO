/**
 * Commands arriving from outside the interface.
 *
 * The desktop registers Quick Note and Quick Paste as *global* accelerators —
 * they have to fire while another application has the keyboard, which is the
 * entire point of them — so those key presses are seen by the main process, not
 * by the window. This is how they get back in.
 *
 * It is a bus rather than a prop because the two ends are a long way apart: the
 * platform layer that knows about Electron cannot reach into the shell's
 * command table, and the shell must not learn what Electron is. Each side knows
 * only a command id, which is the same string the command palette and the menu
 * already use.
 *
 * Nothing here is Electron-specific. Anything that can produce a command id —
 * a tray menu, a protocol handler, a notification action — can use it.
 */

/**
 * `argument` is the one thing a command id cannot say by itself: which
 * document to open. The dock lists the last few documents and has to be able
 * to ask for one by id, and inventing a command per document would be a
 * registry that grows with the workspace.
 */
export type AppCommandListener = (commandId: string, argument?: string) => void;

const listeners = new Set<AppCommandListener>();

/** Runs `commandId` in whichever window is listening. */
export function emitAppCommand(commandId: string, argument?: string): void {
  for (const listener of [...listeners]) listener(commandId, argument);
}

export function subscribeToAppCommands(listener: AppCommandListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
