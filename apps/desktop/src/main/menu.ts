import { APP_NAME } from '@noto/config';
import { CORE_COMMANDS, scopeOf, type Command } from '@noto/core';
import { Menu, app, type MenuItemConstructorOptions } from 'electron';

import { MENU_LAYOUT, SETTINGS_COMMAND, type MenuEntry } from './menu-layout';

/**
 * The application menu.
 *
 * Every item is a command id from the shared registry, and choosing one does
 * exactly what the palette does with it: the id is sent to the window, where
 * the shell's own handler — or the editor in front — runs it.
 *
 * ## Keys
 *
 * The renderer already binds every key itself, in the window and inside the
 * editor. On Windows and Linux the menu shows the key without registering it
 * (`registerAccelerator: false`); registering it too would run each command
 * twice, which for a toggle is the same as not running it.
 *
 * macOS gives the menu first claim on a key and the page never sees it, so
 * there the menu does register app keys and the renderer's binding simply goes
 * unused. Editor keys are the exception: Cmd+B and Cmd+Z belong to whatever
 * has the caret — a text field in a dialog as much as the document — so on
 * macOS those items carry no key, and ProseMirror keeps it.
 */

const COMMANDS = new Map(CORE_COMMANDS.map((command) => [command.id, command]));

const isMac = process.platform === 'darwin';

export interface MenuActions {
  /** Runs a command in the application window, bringing it forward first. */
  run(commandId: string): void;
  /**
   * Commands the main process answers itself rather than the window. Quick
   * Note is one: with the window hidden, it opens the dock, not the window.
   */
  overrides: Record<string, () => void>;
}

function commandItem(command: Command, actions: MenuActions): MenuItemConstructorOptions {
  const override = actions.overrides[command.id];
  const showKey = command.shortcut && !(isMac && scopeOf(command) === 'editor');

  return {
    label: command.title,
    ...(showKey ? { accelerator: command.shortcut, registerAccelerator: isMac } : {}),
    click: () => (override ? override() : actions.run(command.id)),
  };
}

function entryItem(entry: MenuEntry, actions: MenuActions): MenuItemConstructorOptions | null {
  if (entry === '-') return { type: 'separator' };
  if (typeof entry !== 'string') return { role: entry.role };

  const command = COMMANDS.get(entry);
  // The layout test keeps this from happening; a missing item beats a crash if it does.
  return command ? commandItem(command, actions) : null;
}

export function buildMenuTemplate(actions: MenuActions): MenuItemConstructorOptions[] {
  const settings = COMMANDS.get(SETTINGS_COMMAND);
  const settingsItem = settings ? commandItem(settings, actions) : null;

  const sections: MenuItemConstructorOptions[] = MENU_LAYOUT.map((section) => {
    const items = section.entries
      .map((entry) => entryItem(entry, actions))
      .filter((item): item is MenuItemConstructorOptions => item !== null);

    // Windows and Linux keep Settings and Exit at the foot of File.
    if (!isMac && section.label === '&File') {
      if (settingsItem) items.push({ type: 'separator' }, settingsItem);
      items.push({ type: 'separator' }, { role: 'quit', label: 'E&xit' });
    }

    // Developer tools only where a developer is the one running Noto.
    if (section.label === '&View' && !app.isPackaged) {
      items.push({ type: 'separator' }, { role: 'toggleDevTools' });
    }

    return { label: isMac ? section.label.replace('&', '') : section.label, submenu: items };
  });

  if (!isMac) return sections;

  // macOS puts About, Settings, Hide and Quit under the application's own name.
  return [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        ...(settingsItem ? [settingsItem, { type: 'separator' } as const] : []),
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    ...sections,
  ];
}

export function installApplicationMenu(actions: MenuActions): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(actions)));
}
