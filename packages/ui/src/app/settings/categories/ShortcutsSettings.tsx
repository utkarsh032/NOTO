import { CORE_COMMANDS, formatShortcut } from '@noto/core';
import { useMemo } from 'react';

import { KeyHint } from '../../../components/KeyHint';
import { SettingsSection } from '../SettingsSection';
import { detectShortcutPlatform } from '../../use-command-shortcuts';

/** The Shortcuts section of Settings. */
export function ShortcutsSettings() {
  const platform = useMemo(() => detectShortcutPlatform(), []);

  return (
    <SettingsSection
      title="Keyboard shortcuts"
      description="Every command in Noto, and the keys bound to it."
    >
      <div className="max-h-[480px] overflow-y-auto">
        <ul className="divide-default divide-y">
          {CORE_COMMANDS.filter((command) => command.shortcut).map((command) => (
            <li key={command.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <span className="text-primary text-body-sm min-w-0 truncate">{command.title}</span>
              <KeyHint keys={formatShortcut(command.shortcut!, platform)} />
            </li>
          ))}
        </ul>
      </div>
    </SettingsSection>
  );
}
