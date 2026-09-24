import { Badge } from '../../../components/Badge';
import { SettingsRow, SettingsSection } from '../SettingsSection';

/** The General section of Settings. */
export function GeneralSettings() {
  return (
    <SettingsSection
      title="General"
      description="How Noto behaves when it starts and where it sends you."
    >
      <SettingsRow
        label="Startup"
        description="Noto opens on Home, with your tabs restored underneath."
        control={<Badge>Home</Badge>}
      />
      <SettingsRow
        label="Default view"
        description="Documents are listed as a table until you switch to the grid."
        control={<Badge>Table</Badge>}
      />
      <SettingsRow
        label="Language and formats"
        description="Dates, times and number formats follow this device."
        control={<Badge>{typeof navigator === 'undefined' ? 'System' : navigator.language}</Badge>}
      />
      <SettingsRow
        label="Telemetry"
        description="Noto collects nothing. There is no analytics service to switch off."
        control={<Badge tone="brand">Off</Badge>}
      />
      <SettingsRow
        label="Open links in"
        description="Links in a document open in your browser, never inside the editor."
        control={<Badge>Browser</Badge>}
      />
    </SettingsSection>
  );
}
