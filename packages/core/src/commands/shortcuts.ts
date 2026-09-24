import type { Command, CommandContext } from './types.ts';

/* -------------------------------------------------------------------------- */
/* Accelerators                                                               */
/* -------------------------------------------------------------------------- */

export type ShortcutPlatform = 'mac' | 'other';

/**
 * The parts of a keyboard event an accelerator depends on.
 *
 * Declared structurally rather than as `KeyboardEvent` so that command matching
 * stays a pure function: core has no DOM, and the desktop main process matches
 * the same accelerators against Electron's own event shape.
 */
export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/**
 * Resolves an accelerator against a platform.
 *
 * `CmdOrCtrl` becomes Command on macOS and Control everywhere else, which is
 * why accelerators are stored in that notation rather than pre-resolved: one
 * command definition serves every platform.
 */
function parseShortcut(shortcut: string, platform: ShortcutPlatform): ParsedShortcut | null {
  const parts = shortcut.split('+').map((part) => part.trim());
  const key = parts.pop();
  if (!key) return null;

  const parsed: ParsedShortcut = {
    key: key.toLowerCase(),
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
  };

  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'cmdorctrl':
      case 'commandorcontrol':
        if (platform === 'mac') parsed.meta = true;
        else parsed.ctrl = true;
        break;
      case 'cmd':
      case 'command':
      case 'meta':
      case 'super':
        parsed.meta = true;
        break;
      case 'ctrl':
      case 'control':
        parsed.ctrl = true;
        break;
      case 'shift':
        parsed.shift = true;
        break;
      case 'alt':
      case 'option':
        parsed.alt = true;
        break;
      default:
        // An unknown modifier would otherwise match too eagerly.
        return null;
    }
  }

  return parsed;
}

/**
 * True when `event` is exactly this accelerator.
 *
 * Modifiers are compared exhaustively, so `CmdOrCtrl+N` does not fire when the
 * user presses `CmdOrCtrl+Shift+N` — the two are separate commands.
 */
export function matchesShortcut(
  shortcut: string,
  event: ShortcutEvent,
  platform: ShortcutPlatform,
): boolean {
  const parsed = parseShortcut(shortcut, platform);
  if (!parsed) return false;

  return (
    // Shift+letter arrives as an uppercase `key`, so both sides are lowered.
    event.key.toLowerCase() === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.metaKey === parsed.meta &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt
  );
}

const MAC_SYMBOLS: Record<string, string> = {
  meta: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
};

const DISPLAY_KEYS: Record<string, string> = {
  ' ': 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
};

/** Renders an accelerator the way the platform writes it, for menus and hints. */
export function formatShortcut(shortcut: string, platform: ShortcutPlatform): string {
  const parsed = parseShortcut(shortcut, platform);
  if (!parsed) return shortcut;

  const key = DISPLAY_KEYS[parsed.key] ?? parsed.key.toUpperCase();

  if (platform === 'mac') {
    // macOS orders modifiers ⌃⌥⇧⌘ and joins them without separators.
    let prefix = '';
    if (parsed.ctrl) prefix += MAC_SYMBOLS.ctrl;
    if (parsed.alt) prefix += MAC_SYMBOLS.alt;
    if (parsed.shift) prefix += MAC_SYMBOLS.shift;
    if (parsed.meta) prefix += MAC_SYMBOLS.meta;
    return `${prefix}${key}`;
  }

  const modifiers: string[] = [];
  if (parsed.ctrl) modifiers.push('Ctrl');
  if (parsed.meta) modifiers.push('Win');
  if (parsed.alt) modifiers.push('Alt');
  if (parsed.shift) modifiers.push('Shift');

  return [...modifiers, key].join('+');
}

const KEYMAP_MODIFIERS: Record<string, string> = {
  cmdorctrl: 'Mod',
  commandorcontrol: 'Mod',
  cmd: 'Meta',
  command: 'Meta',
  meta: 'Meta',
  super: 'Meta',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
};

/** Emitted in this order so a binding reads the same way every time. */
const KEYMAP_MODIFIER_ORDER = ['Mod', 'Meta', 'Ctrl', 'Alt', 'Shift'];

/**
 * Rewrites an accelerator into the `Mod-` notation ProseMirror keymaps use.
 *
 * This is what lets the registry be the editor's keymap rather than a
 * description of it: `@noto/editor` binds the result, so `CmdOrCtrl+Shift+7`
 * defined above is literally the key that makes a numbered list. Returns `null`
 * for an accelerator that cannot be expressed, which the caller skips.
 */
export function toKeymapBinding(shortcut: string): string | null {
  const parts = shortcut.split('+').map((part) => part.trim());
  const key = parts.pop();
  if (!key) return null;

  const modifiers = new Set<string>();
  for (const part of parts) {
    const modifier = KEYMAP_MODIFIERS[part.toLowerCase()];
    if (!modifier) return null;
    modifiers.add(modifier);
  }

  // ProseMirror matches letters case-insensitively only when they are written
  // lowercase; `Mod-B` and `Mod-b` are two different bindings to it.
  const normalizedKey = /^[a-z]$/iu.test(key) ? key.toLowerCase() : key;

  const ordered = KEYMAP_MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...ordered, normalizedKey].join('-');
}

/** Looks up the command an event triggers, honouring `isEnabled`. */
export function findCommandForEvent(
  commands: readonly Command[],
  event: ShortcutEvent,
  context: CommandContext,
  platform: ShortcutPlatform,
): Command | undefined {
  return commands.find((command) => {
    const accelerators = [command.shortcut, ...(command.aliases ?? [])].filter(
      (accelerator): accelerator is string => Boolean(accelerator),
    );
    if (accelerators.length === 0) return false;
    if (!accelerators.some((accelerator) => matchesShortcut(accelerator, event, platform))) {
      return false;
    }

    return command.isEnabled?.(context) ?? true;
  });
}
