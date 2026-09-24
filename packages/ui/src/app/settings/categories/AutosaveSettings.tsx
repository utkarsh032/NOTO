import { AUTOSAVE_DELAY_MS } from '@noto/config';
import { useSettingsStore } from '@noto/core';

import { Badge } from '../../../components/Badge';
import { Select } from '../../../components/Input';
import { SettingsRow, SettingsSection } from '../SettingsSection';

/** The Autosave section of Settings. */
export function AutosaveSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  return (
    <SettingsSection
      title="Auto Save"
      description="Noto writes as you type. Nothing here turns that off."
    >
      <SettingsRow
        label="Save delay"
        description="How long Noto waits after the last keystroke before writing."
        htmlFor="noto-autosave"
        control={
          <Select
            id="noto-autosave"
            fieldSize="sm"
            className="w-40"
            value={String(settings.editor.autoSaveDelayMs)}
            onChange={(event) => updateEditor({ autoSaveDelayMs: Number(event.target.value) })}
          >
            <option value="300">Immediately (300ms)</option>
            <option value={String(AUTOSAVE_DELAY_MS)}>Standard (600ms)</option>
            <option value="1500">Relaxed (1.5s)</option>
            <option value="3000">Slow (3s)</option>
          </Select>
        }
      />
      <SettingsRow
        label="Crash recovery"
        description="Unsaved work is snapshotted outside the database, and offered back when Noto reopens."
        control={<Badge tone="brand">Always on</Badge>}
      />
    </SettingsSection>
  );
}
