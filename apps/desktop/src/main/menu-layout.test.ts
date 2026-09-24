import { CORE_COMMANDS } from '@noto/core';
import { describe, expect, it } from 'vitest';

import { MENU_LAYOUT, SETTINGS_COMMAND, commandIdsIn } from './menu-layout';

const known = new Set(CORE_COMMANDS.map((command) => command.id));

describe('MENU_LAYOUT', () => {
  const ids = commandIdsIn(MENU_LAYOUT);

  it('names only commands the registry defines', () => {
    expect(ids.filter((id) => !known.has(id))).toEqual([]);
    expect(known.has(SETTINGS_COMMAND)).toBe(true);
  });

  it('lists each command once', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(SETTINGS_COMMAND);
  });

  it('never starts or ends a section with a separator, or doubles one', () => {
    for (const section of MENU_LAYOUT) {
      const { entries } = section;
      expect(entries[0]).not.toBe('-');
      expect(entries.at(-1)).not.toBe('-');
      entries.forEach((entry, index) => {
        if (entry === '-') expect(entries[index + 1]).not.toBe('-');
      });
    }
  });
});
