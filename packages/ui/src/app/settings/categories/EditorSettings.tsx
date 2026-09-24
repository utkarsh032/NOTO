import { MARGIN_PRESETS, PAGE_SIZES, ZOOM_LEVELS } from '@noto/config';
import { useSettingsStore } from '@noto/core';
import type { EditorFontFamily, MarginPresetId, PageLayoutMode, PageSizeId } from '@noto/types';

import { Input, Select } from '../../../components/Input';
import { Toggle } from '../../../components/Toggle';
import { MarginFields } from '../../editor/MarginFields';
import { SettingsRow, SettingsSection } from '../SettingsSection';

/** The Editor section of Settings. */
export function EditorSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  return (
    <>
      <SettingsSection title="Typography" description="How the document itself is set.">
        <SettingsRow
          label="Font"
          htmlFor="noto-font"
          control={
            <Select
              id="noto-font"
              fieldSize="sm"
              className="w-40"
              value={settings.editor.fontFamily}
              onChange={(event) =>
                updateEditor({ fontFamily: event.target.value as EditorFontFamily })
              }
            >
              <option value="sans">Sans (Inter)</option>
              <option value="serif">Serif (Source Serif)</option>
              <option value="mono">Mono (JetBrains Mono)</option>
            </Select>
          }
        />
        <SettingsRow
          label="Zoom"
          description="The size the document is presented at, not the size it is stored at."
          htmlFor="noto-zoom"
          control={
            <Select
              id="noto-zoom"
              fieldSize="sm"
              className="w-28"
              value={String(settings.editor.zoom)}
              onChange={(event) => updateEditor({ zoom: Number(event.target.value) })}
            >
              {ZOOM_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {Math.round(level * 100)}%
                </option>
              ))}
            </Select>
          }
        />
        <SettingsRow
          label="Line height"
          htmlFor="noto-line-height"
          control={
            <Input
              id="noto-line-height"
              type="number"
              step="0.05"
              min="1.2"
              max="2.2"
              fieldSize="sm"
              className="w-24"
              value={settings.editor.lineHeight}
              onChange={(event) => updateEditor({ lineHeight: Number(event.target.value) || 1.6 })}
            />
          }
        />
      </SettingsSection>

      {/*
       * Paper. Simple is what Noto opens with — a text file, no page
       * — and everything here is for the document that is going to be
       * printed instead. Choosing a size or a margin turns the page on
       * by itself, the same way the toolbar's control does: nobody
       * sets Letter and Narrow meaning to keep looking at a text file.
       */}
      <SettingsSection
        title="Page layout"
        description="Whether the document is a text file or a sheet of paper."
      >
        <SettingsRow
          label="Layout"
          description="Simple runs the text the width of the window, from the left edge."
          htmlFor="noto-page-mode"
          control={
            <Select
              id="noto-page-mode"
              fieldSize="sm"
              className="w-44"
              value={settings.editor.pageMode}
              onChange={(event) => updateEditor({ pageMode: event.target.value as PageLayoutMode })}
            >
              <option value="simple">Simple text</option>
              <option value="page">Page layout</option>
            </Select>
          }
        />
        <SettingsRow
          label="Paper size"
          description="The sheet the page is drawn at, and printed on."
          htmlFor="noto-page-size"
          control={
            <Select
              id="noto-page-size"
              fieldSize="sm"
              className="w-44"
              value={settings.editor.pageSize}
              onChange={(event) =>
                updateEditor({
                  pageMode: 'page',
                  pageSize: event.target.value as PageSizeId,
                })
              }
            >
              {PAGE_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label} ({size.width} × {size.height} in)
                </option>
              ))}
            </Select>
          }
        />
        <SettingsRow
          label="Margins"
          description="The same named margins every office suite ships."
          htmlFor="noto-margins"
          control={
            <Select
              id="noto-margins"
              fieldSize="sm"
              className="w-44"
              value={settings.editor.marginPreset}
              onChange={(event) =>
                updateEditor({
                  pageMode: 'page',
                  marginPreset: event.target.value as MarginPresetId,
                })
              }
            >
              {MARGIN_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </Select>
          }
        />
        {settings.editor.marginPreset === 'custom' ? (
          <SettingsRow label="Custom margins" description="In inches.">
            <MarginFields
              className="mt-2.5"
              value={settings.editor.customMargins}
              onChange={(customMargins) => updateEditor({ pageMode: 'page', customMargins })}
            />
          </SettingsRow>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Writing" description="What the editor does while you type.">
        <SettingsRow
          label="Word wrap"
          description="Off lets long lines run, and the block scrolls sideways."
          control={
            <Toggle
              hideLabel
              label="Word wrap"
              checked={settings.editor.wordWrap}
              onChange={(wordWrap) => updateEditor({ wordWrap })}
            />
          }
        />
        <SettingsRow
          label="Show characters"
          description="Draws spaces, tabs and paragraph marks."
          control={
            <Toggle
              hideLabel
              label="Show characters"
              checked={settings.editor.showInvisibles}
              onChange={(showInvisibles) => updateEditor({ showInvisibles })}
            />
          }
        />
        <SettingsRow
          label="Spell check"
          description="Uses the dictionaries your operating system already has."
          control={
            <Toggle
              hideLabel
              label="Spell check"
              checked={settings.editor.spellCheck}
              onChange={(spellCheck) => updateEditor({ spellCheck })}
            />
          }
        />
      </SettingsSection>
    </>
  );
}
