import { CORE_COMMANDS, formatShortcut } from '@noto/core';
import type { CommandCategory } from '@noto/core';
import { useMemo } from 'react';

import { Dialog } from '../../components/Dialog';
import { KeyHint } from '../../components/KeyHint';
import { detectShortcutPlatform } from '../use-command-shortcuts';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose(): void;
}

/** The order the categories are worth reading in. */
const ORDER: CommandCategory[] = ['file', 'edit', 'format', 'insert', 'view', 'navigation', 'app'];

const HEADING: Record<CommandCategory, string> = {
  file: 'Documents',
  edit: 'Editing',
  format: 'Formatting',
  insert: 'Inserting',
  view: 'View',
  navigation: 'Navigation',
  app: 'Application',
};

/**
 * Every shortcut Noto has, read from the command registry.
 *
 * Not a written list: a hand-maintained table of keys is a table that goes
 * stale the first time a binding moves. These are the same entries the keyboard
 * listener resolves against, formatted for this platform.
 */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const platform = useMemo(() => detectShortcutPlatform(), []);

  const groups = useMemo(() => {
    const bound = CORE_COMMANDS.filter((command) => command.shortcut);

    return ORDER.map((category) => ({
      category,
      commands: bound.filter((command) => command.category === category),
    })).filter((group) => group.commands.length > 0);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Everything Noto can do without reaching for the mouse."
      size="lg"
    >
      <div className="noto-scroll-y max-h-[60vh] overflow-y-auto px-6 py-5">
        <div className="columns-1 gap-8 md:columns-2">
          {groups.map((group) => (
            <section key={group.category} className="mb-6 break-inside-avoid">
              <h3 className="text-tertiary text-caption mb-2 tracking-wide uppercase">
                {HEADING[group.category]}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.commands.map((command) => (
                  <li key={command.id} className="flex items-center justify-between gap-4">
                    <span className="text-secondary text-body-sm min-w-0 truncate">
                      {command.title}
                    </span>
                    <KeyHint keys={formatShortcut(command.shortcut!, platform)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
