import { formatShortcut } from '@noto/core';
import { useMemo } from 'react';

import { Badge } from '../../../components/Badge';
import { KeyHint } from '../../../components/KeyHint';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { detectShortcutPlatform } from '../../use-command-shortcuts';

/** The Clipboard section of Settings. */
export function ClipboardSettings() {
  const platform = useMemo(() => detectShortcutPlatform(), []);

  return (
    <SettingsSection
      title="Clipboard"
      description="Clipboard history is part of Memory rather than a store of its own."
    >
      <SettingsRow
        label="Watch the clipboard"
        description="Requires the desktop background service."
        control={<Badge>Coming soon</Badge>}
      />
      <SettingsRow
        label="Quick Paste"
        description="Search everything captured and paste it without leaving the keyboard."
        control={<KeyHint keys={formatShortcut('CmdOrCtrl+Alt+V', platform)} />}
      />
    </SettingsSection>
  );
}
