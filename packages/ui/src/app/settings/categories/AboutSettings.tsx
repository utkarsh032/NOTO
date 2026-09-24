import { APP_NAME, APP_VERSION } from '@noto/config';

import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { CameraIcon, DatabaseIcon, DocumentsIcon } from '../../../components/icons';
import { formatBytes } from '../../../utils/format';
import { SettingsRow, SettingsSection } from '../SettingsSection';
import { isUpdateWaiting, useUpdateStatus } from '../../updates';
import { useNotoData } from '../../data-context';
import { useDocumentBytes } from './use-document-bytes';

/** The About section of Settings. */
export function AboutSettings({ setCategory }: { setCategory(category: 'updates'): void }) {
  const update = useUpdateStatus();
  const usedBytes = useDocumentBytes();
  const { documents } = useNotoData();

  return (
    <SettingsSection title={`About ${APP_NAME}`}>
      <SettingsRow
        label="Version"
        description={isUpdateWaiting(update) ? `${update.version} has been released.` : undefined}
        control={
          <div className="flex items-center gap-2">
            <Badge>{APP_VERSION}</Badge>
            {isUpdateWaiting(update) ? (
              <Button size="sm" onClick={() => setCategory('updates')}>
                Update
              </Button>
            ) : null}
          </div>
        }
      />
      <SettingsRow
        label="What Noto is"
        description="A local-first writing, document, memory and search workspace for desktop, web and mobile."
      />
      <SettingsRow
        label="Storage"
        description={`${(documents ?? []).length} documents, ${formatBytes(usedBytes)} on this device.`}
        control={<DatabaseIcon className="text-tertiary h-5 w-5" />}
      />
      <SettingsRow
        label="Capture"
        description="Screenshots and clipboard capture arrive with the desktop background service."
        control={<CameraIcon className="text-tertiary h-5 w-5" />}
      />
      <SettingsRow
        label="Documents"
        description="Everything you write is stored as structured content, not as HTML."
        control={<DocumentsIcon className="text-tertiary h-5 w-5" />}
      />
    </SettingsSection>
  );
}
