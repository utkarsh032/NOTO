import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { useNotoData } from '../../data-context';
import { navigate } from '../../router';

/** The Files section of Settings. */
export function FilesSettings() {
  const { workspace } = useNotoData();

  return (
    <SettingsSection
      title="Files & Folders"
      description="Where documents live, and how they leave."
    >
      <SettingsRow
        label="Workspace"
        description="Every document on this device belongs to this workspace."
        control={<Badge tone="brand">{workspace?.name ?? 'Local'}</Badge>}
      />
      <SettingsRow
        label="Folders"
        description="Made in the sidebar with the + beside the workspace name. Drag a document onto a folder to move it, or pick its folder in the Info tab."
      />
      <SettingsRow
        label="Import and export"
        description="Text, Markdown, HTML and Noto JSON, read and written on this device."
        control={
          <Button variant="secondary" size="sm" onClick={() => navigate('documents')}>
            Open Documents
          </Button>
        }
      />
    </SettingsSection>
  );
}
