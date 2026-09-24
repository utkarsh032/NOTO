import { CORE_COMMANDS } from './definitions.ts';
import type { Command, CommandContext } from './types.ts';

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
