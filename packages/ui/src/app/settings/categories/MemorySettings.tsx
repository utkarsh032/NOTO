import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { navigate } from '../../router';

/** The Memory section of Settings. */
export function MemorySettings() {
  return (
    <SettingsSection
      title="Noto Memory"
      description="What Noto keeps hold of, beyond your documents."
    >
      <SettingsRow
        label="Capture"
        description="Clipboard, screenshots and links are captured by a background service that is not built yet."
        control={<Badge>Coming soon</Badge>}
      />
      <SettingsRow
        label="Browse what is there"
        control={
          <Button variant="secondary" size="sm" onClick={() => navigate('memory')}>
            Open Memory
          </Button>
        }
      />
    </SettingsSection>
  );
}
