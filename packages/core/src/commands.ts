/**
 * Command registry.
 *
 * Every user-triggerable action in Noto — menu items, the command palette,
 * keyboard shortcuts, the desktop application menu — resolves to a command
 * defined here, so a shortcut and a menu entry can never drift apart.
 */

export type CommandCategory = 'file' | 'edit' | 'format' | 'view' | 'navigation' | 'app';

export interface CommandContext {
  hasActiveDocument: boolean;
  hasSelection: boolean;
  isEditable: boolean;
}

export interface Command {
  id: string;
  title: string;
  category: CommandCategory;
  /**
   * Accelerator in Electron/CodeMirror notation. `CmdOrCtrl` is resolved to the
   * platform modifier at display time.
   */
  shortcut?: string;
  keywords?: string[];
  /** Defaults to always available when omitted. */
  isEnabled?: (context: CommandContext) => boolean;
}

const requiresDocument = (context: CommandContext): boolean => context.hasActiveDocument;
const requiresEditable = (context: CommandContext): boolean =>
  context.hasActiveDocument && context.isEditable;

/** The commands available before any feature work begins. */
export const CORE_COMMANDS: readonly Command[] = [
  {
    id: 'document.new',
    title: 'New Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+N',
    keywords: ['create', 'note', 'page'],
  },
  {
    id: 'folder.new',
    title: 'New Folder',
    category: 'file',
    shortcut: 'CmdOrCtrl+Shift+N',
  },
  {
    id: 'document.save',
    title: 'Save Document',
    category: 'file',
    shortcut: 'CmdOrCtrl+S',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.archive',
    title: 'Archive Document',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.delete',
    title: 'Move Document to Trash',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'document.toggleFavorite',
    title: 'Toggle Favorite',
    category: 'file',
    isEnabled: requiresDocument,
  },
  {
    id: 'format.bold',
    title: 'Bold',
    category: 'format',
    shortcut: 'CmdOrCtrl+B',
    isEnabled: requiresEditable,
  },
  {
    id: 'format.italic',
    title: 'Italic',
    category: 'format',
    shortcut: 'CmdOrCtrl+I',
    isEnabled: requiresEditable,
  },
  {
    id: 'format.code',
    title: 'Inline Code',
    category: 'format',
    shortcut: 'CmdOrCtrl+E',
    isEnabled: requiresEditable,
  },
  {
    id: 'view.toggleSidebar',
    title: 'Toggle Sidebar',
    category: 'view',
    shortcut: 'CmdOrCtrl+\\',
  },
  {
    id: 'view.toggleTheme',
    title: 'Toggle Dark Mode',
    category: 'view',
  },
  {
    id: 'navigation.commandPalette',
    title: 'Command Palette',
    category: 'navigation',
    shortcut: 'CmdOrCtrl+K',
    keywords: ['search', 'go to', 'jump'],
  },
  {
    id: 'app.settings',
    title: 'Settings',
    category: 'app',
    shortcut: 'CmdOrCtrl+,',
  },
];

export function createCommandRegistry(commands: readonly Command[] = CORE_COMMANDS) {
  const byId = new Map(commands.map((command) => [command.id, command]));

  return {
    all: (): readonly Command[] => commands,

    get: (id: string): Command | undefined => byId.get(id),

    available: (context: CommandContext): Command[] =>
      commands.filter((command) => command.isEnabled?.(context) ?? true),

    /** Case-insensitive match over title and keywords, for the command palette. */
    search: (query: string, context: CommandContext): Command[] => {
      const needle = query.trim().toLowerCase();
      const candidates = commands.filter((command) => command.isEnabled?.(context) ?? true);
      if (needle === '') return candidates;

      return candidates.filter((command) => {
        if (command.title.toLowerCase().includes(needle)) return true;
        return command.keywords?.some((keyword) => keyword.includes(needle)) ?? false;
      });
    },
  };
}

export type CommandRegistry = ReturnType<typeof createCommandRegistry>;

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

/** Looks up the command an event triggers, honouring `isEnabled`. */
export function findCommandForEvent(
  commands: readonly Command[],
  event: ShortcutEvent,
  context: CommandContext,
  platform: ShortcutPlatform,
): Command | undefined {
  return commands.find((command) => {
    if (!command.shortcut) return false;
    if (!matchesShortcut(command.shortcut, event, platform)) return false;
    return command.isEnabled?.(context) ?? true;
  });
}
