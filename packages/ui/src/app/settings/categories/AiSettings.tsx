import { Badge } from '../../../components/Badge';
import { SettingsRow, SettingsSection } from '../SettingsSection';

/** The Ai section of Settings. */
export function AiSettings() {
  return (
    <SettingsSection
      title="AI Assistant"
      description="Noto AI is a panel beside your writing, never a layer over it."
    >
      <SettingsRow
        label="Model"
        description="No model is connected, so nothing you write is sent anywhere."
        control={<Badge tone="ai">Not connected</Badge>}
      />
      <SettingsRow
        label="Where it appears"
        description="In the workspace's context panel, and from the Ask AI button in Search."
        control={<Badge>Panel only</Badge>}
      />
    </SettingsSection>
  );
}
