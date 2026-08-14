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
