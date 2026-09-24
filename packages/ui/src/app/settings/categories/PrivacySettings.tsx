import { useSettingsStore } from '@noto/core';

import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { navigate } from '../../router';

/** The Privacy section of Settings. */
export function PrivacySettings() {
  const settings = useSettingsStore((state) => state.settings);

  return (
    <SettingsSection
      title="Privacy & Security"
      description="What leaves this device, and what does not."
    >
      <SettingsRow
        label="Where your documents are"
        description="In this browser's storage on web, and in a SQLite file on desktop. Nowhere else."
        control={<Badge tone="brand">On this device</Badge>}
      />
      <SettingsRow
        label="Network"
        description="Noto makes no network requests while sync is off."
        control={<Badge tone="brand">{settings.syncEnabled ? 'Sync on' : 'Offline'}</Badge>}
      />
      <SettingsRow
        label="Account security"
        control={
          <Button variant="secondary" size="sm" onClick={() => navigate('account')}>
            Open Account
          </Button>
        }
      />
    </SettingsSection>
  );
}
