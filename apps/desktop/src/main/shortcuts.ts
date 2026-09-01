import { CORE_COMMANDS } from '@noto/core';
import { globalShortcut } from 'electron';

/**
 * The accelerators Noto claims from the whole operating system.
 *
 * An ordinary shortcut is bound inside the window and only fires when Noto has
 * the keyboard. These fire whatever has it — which is the entire point of Quick
 * Note and Quick Paste, since the moment worth capturing a thought is almost
 * never a moment when a notes application is the thing in front of you.
 *
 * They are deliberately few. A global accelerator is taken away from every
 * other application on the machine, so the bar for registering one is that it
 * would be useless bound any other way.
 *
 * The keys themselves are not written here. They come from the shared command
 * registry, which is also what the command palette lists and what the sidebar
 * prints on the Quick Note card — so the hint the user is shown and the key the
 * system actually listens for cannot drift apart.
 */

/** Command ids to bind, each with what to do when the key is pressed. */
export type GlobalShortcutHandlers = Record<string, () => void>;

const registered: string[] = [];

export function registerGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  for (const [commandId, handler] of Object.entries(handlers)) {
    const command = CORE_COMMANDS.find((candidate) => candidate.id === commandId);
    const accelerator = command?.shortcut;

    if (!accelerator) continue;

    /*
     * Registration fails when another application already holds the key. That
     * is a normal thing to happen on somebody else's machine and not an error
     * worth stopping the launch over: Noto simply does not get that key, and
     * the same command is still on the menu, in the palette and on the dock.
     */
    try {
      if (globalShortcut.register(accelerator, handler)) registered.push(accelerator);
    } catch {
      // Malformed accelerators are a programming error, and would have thrown
      // in development long before a build reached anybody.
    }
  }
}

/**
 * Hands every key back.
 *
 * Electron does this on quit anyway, but only for a clean quit; doing it in
 * `before-quit` means a key Noto took is released even when the process is
 * ending for some other reason.
 */
export function unregisterGlobalShortcuts(): void {
  for (const accelerator of registered) globalShortcut.unregister(accelerator);
  registered.length = 0;
}
