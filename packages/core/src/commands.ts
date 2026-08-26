/**
 * Command registry.
 *
 * Every user-triggerable action in Noto — menu items, the command palette,
 * keyboard shortcuts, the desktop application menu — resolves to a command
 * defined here, so a shortcut and a menu entry can never drift apart.
 */

export type CommandCategory = 'file' | 'edit' | 'format' | 'insert' | 'view' | 'navigation' | 'app';

export interface CommandContext {
  hasActiveDocument: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  /** True when the caret sits inside a table cell. Optional: most callers never enter one. */
  isInTable?: boolean;
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
const requiresTable = (context: CommandContext): boolean =>
  requiresEditable(context) && context.isInTable === true;

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

  /*
   * Formatting.
   *
   * The accelerators below are the editor's keymap, not a second copy of it:
   * `@noto/editor` builds ProseMirror's bindings from these entries, so a
   * shortcut changed here changes what the editor actually does.
   *
   * Where an accelerator matches Tiptap's own default it is repeated
   * deliberately — the registry has to state it for menus and the command
   * palette to render, and stating it is what keeps the two in step.
   */
  {
    id: 'format.bold',
    title: 'Bold',
    category: 'format',
    shortcut: 'CmdOrCtrl+B',
    keywords: ['strong', 'weight'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.italic',
    title: 'Italic',
    category: 'format',
    shortcut: 'CmdOrCtrl+I',
    keywords: ['emphasis', 'oblique'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.underline',
    title: 'Underline',
    category: 'format',
    shortcut: 'CmdOrCtrl+U',
    isEnabled: requiresEditable,
  },
  {
    id: 'format.strike',
    title: 'Strikethrough',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+S',
    keywords: ['strikethrough', 'cross out'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.code',
    title: 'Inline Code',
    category: 'format',
    shortcut: 'CmdOrCtrl+E',
    keywords: ['monospace'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.link',
    title: 'Link',
    category: 'format',
    /*
     * Not `CmdOrCtrl+K`, which the command palette already owns. Link is the
     * more common binding elsewhere, but the palette is reachable from every
     * screen and formatting is not, so the palette keeps the shorter key.
     */
    shortcut: 'CmdOrCtrl+Shift+K',
    keywords: ['url', 'hyperlink', 'anchor'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.paragraph',
    title: 'Paragraph',
    category: 'format',
    shortcut: 'CmdOrCtrl+Alt+0',
    keywords: ['body', 'normal text'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading1',
    title: 'Heading 1',
    category: 'format',
    shortcut: 'CmdOrCtrl+Alt+1',
    keywords: ['title', 'h1'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading2',
    title: 'Heading 2',
    category: 'format',
    shortcut: 'CmdOrCtrl+Alt+2',
    keywords: ['subtitle', 'h2'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.heading3',
    title: 'Heading 3',
    category: 'format',
    shortcut: 'CmdOrCtrl+Alt+3',
    keywords: ['h3'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.bulletList',
    title: 'Bullet List',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+8',
    keywords: ['unordered', 'bullets', 'points'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.orderedList',
    title: 'Numbered List',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+7',
    keywords: ['ordered', 'numbers'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.blockquote',
    title: 'Blockquote',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+B',
    keywords: ['quote', 'citation'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.codeBlock',
    title: 'Code Block',
    category: 'format',
    shortcut: 'CmdOrCtrl+Alt+C',
    keywords: ['snippet', 'fenced', 'monospace'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignLeft',
    title: 'Align Left',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+L',
    keywords: ['alignment'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignCenter',
    title: 'Align Center',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+E',
    keywords: ['alignment', 'centre'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignRight',
    title: 'Align Right',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+R',
    keywords: ['alignment'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.alignJustify',
    title: 'Justify',
    category: 'format',
    shortcut: 'CmdOrCtrl+Shift+J',
    keywords: ['alignment', 'justified'],
    isEnabled: requiresEditable,
  },
  {
    id: 'format.clear',
    title: 'Clear Formatting',
    category: 'format',
    keywords: ['remove', 'plain', 'reset'],
    isEnabled: requiresEditable,
  },

  /* Insertions. */
  {
    id: 'insert.image',
    title: 'Insert Image',
    category: 'insert',
    keywords: ['picture', 'photo', 'figure'],
    isEnabled: requiresEditable,
  },
  {
    id: 'insert.horizontalRule',
    title: 'Insert Divider',
    category: 'insert',
    keywords: ['horizontal rule', 'separator', 'line'],
    isEnabled: requiresEditable,
  },
  {
    id: 'insert.table',
    title: 'Insert Table',
    category: 'insert',
    keywords: ['grid', 'rows', 'columns'],
    isEnabled: requiresEditable,
  },
  {
    id: 'table.addRowAfter',
    title: 'Insert Row Below',
    category: 'insert',
    isEnabled: requiresTable,
  },
  {
    id: 'table.addColumnAfter',
    title: 'Insert Column After',
    category: 'insert',
    isEnabled: requiresTable,
  },
  {
    id: 'table.deleteRow',
    title: 'Delete Row',
    category: 'insert',
    isEnabled: requiresTable,
  },
  {
    id: 'table.deleteColumn',
    title: 'Delete Column',
    category: 'insert',
    isEnabled: requiresTable,
  },
  {
    id: 'table.toggleHeaderRow',
    title: 'Toggle Header Row',
    category: 'insert',
    isEnabled: requiresTable,
  },
  {
    id: 'table.delete',
    title: 'Delete Table',
    category: 'insert',
    isEnabled: requiresTable,
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
    if (!command.shortcut) return false;
    if (!matchesShortcut(command.shortcut, event, platform)) return false;
    return command.isEnabled?.(context) ?? true;
  });
}
