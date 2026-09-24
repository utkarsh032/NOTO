import { useSettingsStore } from '@noto/core';

import { Button } from '../../../components/Button';
import { Toggle } from '../../../components/Toggle';
import { showToast } from '../../../components/toast-store';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { navigate } from '../../router';

/** The Sync section of Settings. */
export function SyncSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const setSyncEnabled = useSettingsStore((state) => state.setSyncEnabled);

  return (
    <SettingsSection
      title="Sync & Backup"
      description="Off by default. Noto is complete without it."
    >
      <SettingsRow
        label="Sync across devices"
        description="Queues local changes and sends them when a workspace is connected."
        control={
          <Toggle
            hideLabel
            label="Sync across devices"
            checked={settings.syncEnabled}
            onChange={(enabled) => {
              setSyncEnabled(enabled);
              showToast(
                enabled
                  ? 'Sync is on. Changes will queue until a workspace is connected.'
                  : 'Sync is off. Everything stays on this device.',
              );
            }}
          />
        }
      />
      <SettingsRow
        label="Backup"
        description="Export a document as Markdown or JSON from its menu, any time."
        control={
          <Button variant="secondary" size="sm" onClick={() => navigate('documents')}>
            Export documents
          </Button>
        }
      />
    </SettingsSection>
  );
}
