import { describe, expect, it } from 'vitest';

import {
  CORE_COMMANDS,
  type CommandContext,
  type ShortcutEvent,
  createCommandRegistry,
  findCommandForEvent,
  formatShortcut,
  matchesShortcut,
} from './commands';

const press = (key: string, modifiers: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

const editing: CommandContext = {
  hasActiveDocument: true,
  hasSelection: false,
  isEditable: true,
};

const empty: CommandContext = {
  hasActiveDocument: false,
  hasSelection: false,
  isEditable: false,
};

describe('matchesShortcut', () => {
  it('resolves CmdOrCtrl per platform', () => {
    expect(matchesShortcut('CmdOrCtrl+N', press('n', { metaKey: true }), 'mac')).toBe(true);
    expect(matchesShortcut('CmdOrCtrl+N', press('n', { ctrlKey: true }), 'mac')).toBe(false);

    expect(matchesShortcut('CmdOrCtrl+N', press('n', { ctrlKey: true }), 'other')).toBe(true);
    expect(matchesShortcut('CmdOrCtrl+N', press('n', { metaKey: true }), 'other')).toBe(false);
  });

  it('requires an exact modifier match', () => {
    const withShift = press('n', { ctrlKey: true, shiftKey: true });

    expect(matchesShortcut('CmdOrCtrl+N', withShift, 'other')).toBe(false);
    expect(matchesShortcut('CmdOrCtrl+Shift+N', withShift, 'other')).toBe(true);
  });

  it('matches the uppercase key a shifted letter reports', () => {
    expect(
      matchesShortcut('CmdOrCtrl+Shift+N', press('N', { ctrlKey: true, shiftKey: true }), 'other'),
    ).toBe(true);
  });

  it('matches punctuation accelerators', () => {
    expect(matchesShortcut('CmdOrCtrl+\\', press('\\', { ctrlKey: true }), 'other')).toBe(true);
    expect(matchesShortcut('CmdOrCtrl+,', press(',', { metaKey: true }), 'mac')).toBe(true);
  });

  it('rejects an accelerator with an unknown modifier', () => {
    expect(matchesShortcut('Hyper+N', press('n'), 'other')).toBe(false);
  });
});

describe('formatShortcut', () => {
  it('writes macOS accelerators as symbols in the platform order', () => {
    expect(formatShortcut('CmdOrCtrl+N', 'mac')).toBe('⌘N');
    expect(formatShortcut('CmdOrCtrl+Shift+N', 'mac')).toBe('⇧⌘N');
  });

  it('writes other platforms as named modifiers', () => {
    expect(formatShortcut('CmdOrCtrl+N', 'other')).toBe('Ctrl+N');
    expect(formatShortcut('CmdOrCtrl+Shift+N', 'other')).toBe('Ctrl+Shift+N');
  });

  it('returns the accelerator unchanged when it cannot be parsed', () => {
    expect(formatShortcut('Hyper+N', 'other')).toBe('Hyper+N');
  });
});

describe('findCommandForEvent', () => {
  it('finds the command an accelerator triggers', () => {
    const command = findCommandForEvent(
      CORE_COMMANDS,
      press('n', { ctrlKey: true }),
      editing,
      'other',
    );

    expect(command?.id).toBe('document.new');
  });

  it('skips commands that are unavailable in the current context', () => {
    // Save needs an open document; New does not.
    expect(
      findCommandForEvent(CORE_COMMANDS, press('s', { ctrlKey: true }), empty, 'other'),
    ).toBeUndefined();

    expect(
      findCommandForEvent(CORE_COMMANDS, press('s', { ctrlKey: true }), editing, 'other')?.id,
    ).toBe('document.save');
  });

  it('returns nothing for an unbound key', () => {
    expect(
      findCommandForEvent(CORE_COMMANDS, press('q', { ctrlKey: true }), editing, 'other'),
    ).toBeUndefined();
  });
});

describe('CORE_COMMANDS', () => {
  it('binds each accelerator to exactly one command per platform', () => {
    for (const platform of ['mac', 'other'] as const) {
      const seen = new Set<string>();

      for (const command of CORE_COMMANDS) {
        if (!command.shortcut) continue;

        const resolved = formatShortcut(command.shortcut, platform);
        expect(seen.has(resolved), `${resolved} is bound twice on ${platform}`).toBe(false);
        seen.add(resolved);
      }
    }
  });

  it('exposes every command through the registry', () => {
    const registry = createCommandRegistry();
    expect(registry.get('document.save')?.title).toBe('Save Document');
    expect(registry.available(empty).map((command) => command.id)).not.toContain('document.save');
  });
});
