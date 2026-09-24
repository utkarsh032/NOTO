import { useSettingsStore } from '@noto/core';
import type { ThemeMode } from '@noto/types';

import { Select } from '../../../components/Input';
import { Toggle } from '../../../components/Toggle';
import { SettingsRow, SettingsSection } from '../SettingsSection';

/** The Appearance section of Settings. */
export function AppearanceSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAccentColor = useSettingsStore((state) => state.setAccentColor);

  return (
    <SettingsSection title="Appearance" description="How Noto looks on this device.">
      <SettingsRow
        label="Theme"
        description="Dark mode is a separate palette, not an inversion."
        htmlFor="noto-theme"
        control={
          <Select
            id="noto-theme"
            fieldSize="sm"
            className="w-40"
            value={settings.appearance.theme}
            onChange={(event) => setTheme(event.target.value as ThemeMode)}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        }
      />
      <SettingsRow
        label="Accent colour"
        description="Used for primary actions and the active row."
        htmlFor="noto-accent"
        control={
          <input
            id="noto-accent"
            type="color"
            value={settings.appearance.accentColor}
            onChange={(event) => setAccentColor(event.target.value)}
            className="border-default h-8 w-14 cursor-pointer rounded-md border bg-transparent"
          />
        }
      />
      <SettingsRow
        label="Reduced motion"
        description="Noto already follows your system setting; this turns animation off regardless."
        control={
          <Toggle
            hideLabel
            label="Reduced motion"
            checked={settings.appearance.reducedMotion}
            onChange={(checked) =>
              useSettingsStore.setState((state) => ({
                settings: {
                  ...state.settings,
                  appearance: { ...state.settings.appearance, reducedMotion: checked },
                },
              }))
            }
          />
        }
      />
    </SettingsSection>
  );
}
