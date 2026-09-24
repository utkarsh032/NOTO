/**
 * Command registry.
 *
 * Every user-triggerable action in Noto — menu items, the command palette,
 * keyboard shortcuts, the desktop application menu — resolves to a command
 * defined here, so a shortcut and a menu entry can never drift apart.
 */

export * from './commands/types.ts';
export * from './commands/definitions.ts';
export * from './commands/registry.ts';
export * from './commands/shortcuts.ts';
