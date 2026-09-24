import { useSettingsStore } from '@noto/core';

import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Toggle } from '../../../components/Toggle';
import { useAppLock } from '../../app-lock';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { navigate } from '../../router';

/** The Privacy section of Settings. */
export function PrivacySettings() {
  const settings = useSettingsStore((state) => state.settings);
  const lock = useAppLock();

  return (
    <SettingsSection
      title="Privacy & Security"
      description="What leaves this device, and what does not."
    >
      <SettingsRow
        label="Where your documents are"
        description="In this browser's storage on web, and in a SQLite file on desktop and mobile. Nowhere else."
        control={<Badge tone="brand">On this device</Badge>}
      />
      {lock.state ? (
        <SettingsRow
          label="Lock Noto"
          description={
            lock.state.available
              ? `Ask for ${lock.state.method} when Noto opens, and after it has been in the background for 30 seconds.`
              : 'Set up a screen lock on this device first, then Noto can use it.'
          }
          control={
            <Toggle
              label="Lock Noto"
              hideLabel
              checked={lock.state.enabled}
              disabled={lock.busy || (!lock.state.available && !lock.state.enabled)}
              onChange={(checked) => void lock.setEnabled(checked)}
            />
          }
        />
      ) : null}
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
