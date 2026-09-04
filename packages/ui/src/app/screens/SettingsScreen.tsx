import { AUTOSAVE_DELAY_MS, APP_NAME, APP_VERSION, RELEASES_URL, ZOOM_LEVELS } from '@noto/config';
import { CORE_COMMANDS, formatShortcut, useSettingsStore } from '@noto/core';
import type { EditorFontFamily, ThemeMode } from '@noto/types';
import { useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Input, Select } from '../../components/Input';
import { KeyHint } from '../../components/KeyHint';
import { Toggle } from '../../components/Toggle';
import { showToast } from '../../components/toast-store';
import {
  CameraIcon,
  ClipboardIcon,
  CloudIcon,
  DatabaseIcon,
  DocumentsIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FolderIcon,
  HistoryIcon,
  InfoIcon,
  KeyboardIcon,
  MemoryIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  TypeIcon,
  type IconProps,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { formatBytes, relativeTime } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { SettingsRow, SettingsSection } from '../settings/SettingsSection';
import { detectShortcutPlatform } from '../use-command-shortcuts';
import {
  checkForUpdates,
  installUpdate,
  isUpdateWaiting,
  updateCapabilities,
  useUpdateStatus,
} from '../updates';
import { useAccount } from '../use-account';
import { useNotoData } from '../data-context';
import { navigate } from '../router';

type CategoryId =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'files'
  | 'autosave'
  | 'memory'
  | 'clipboard'
  | 'shortcuts'
  | 'ai'
  | 'privacy'
  | 'sync'
  | 'updates'
  | 'about';

interface Category {
  id: CategoryId;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
}

const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { id: 'editor', label: 'Editor', icon: TypeIcon },
  { id: 'files', label: 'Files & Folders', icon: FolderIcon },
  { id: 'autosave', label: 'Auto Save', icon: HistoryIcon },
  { id: 'memory', label: 'Noto Memory', icon: MemoryIcon },
  { id: 'clipboard', label: 'Clipboard', icon: ClipboardIcon },
  { id: 'shortcuts', label: 'Shortcuts', icon: KeyboardIcon },
  { id: 'ai', label: 'AI Assistant', icon: SparklesIcon },
  { id: 'privacy', label: 'Privacy & Security', icon: ShieldIcon },
  { id: 'sync', label: 'Sync & Backup', icon: CloudIcon },
  { id: 'updates', label: 'Updates', icon: DownloadIcon },
  { id: 'about', label: `About ${APP_NAME}`, icon: InfoIcon },
];

/**
 * Settings.
 *
 * Every control here changes something the moment it is used, which is why
 * there is no Save button: the theme switch beside it in the header applies
 * instantly, and one half of a settings screen that saves while the other half
 * does not is the kind of inconsistency people learn by losing work to. Reset
 * is the way back, and it asks first.
 *
 * The categories Noto has not built yet are still listed, and say what they
 * will control rather than showing switches that do nothing.
 */
export function SettingsScreen() {
  const settings = useSettingsStore((state) => state.settings);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAccentColor = useSettingsStore((state) => state.setAccentColor);
  const updateEditor = useSettingsStore((state) => state.updateEditor);
  const setSyncEnabled = useSettingsStore((state) => state.setSyncEnabled);
  const updatePreferences = useSettingsStore((state) => state.updateUpdatePreferences);
  const reset = useSettingsStore((state) => state.reset);

  const { documents, workspace } = useNotoData();
  const { user, plan } = useAccount();

  const [category, setCategory] = useState<CategoryId>('general');
  const [resetting, setResetting] = useState(false);

  const platform = useMemo(() => detectShortcutPlatform(), []);

  const update = useUpdateStatus();
  const { installLabel, appliesOnRestart } = updateCapabilities();

  const usedBytes = useMemo(
    () =>
      (documents ?? []).reduce(
        (total, document) => total + JSON.stringify(document.content).length,
        0,
      ),
    [documents],
  );

  return (
    <PageContainer
      title="Settings"
      subtitle="Customize Noto to work the way you think."
      asideLabel="Account and storage"
      aside={
        <div className="flex flex-col gap-4">
          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Account</h2>
            <p className="text-tertiary text-caption mt-1 truncate">
              {user ? user.email : 'Not signed in'}
            </p>
            <p className="text-tertiary text-caption mt-0.5">{plan.name}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => navigate('account')}
            >
              Manage account
            </Button>
          </aside>

          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Storage</h2>
            <p className="text-tertiary text-caption mt-1">
              {formatBytes(usedBytes)} of documents on this device
            </p>
            <div
              className="bg-surface-tertiary mt-2 h-1.5 overflow-hidden rounded-full"
              role="presentation"
            >
              <div
                className="bg-brand h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(2, (usedBytes / plan.storageLimitBytes) * 100))}%`,
                }}
              />
            </div>
            <p className="text-tertiary text-caption mt-1.5">
              {(documents ?? []).length} documents in {workspace?.name ?? 'this workspace'}
            </p>
          </aside>

          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">Quick actions</h2>
            <div className="mt-2 flex flex-col gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => navigate('documents')}>
                Import or export documents
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCategory('shortcuts')}>
                Keyboard shortcuts
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResetting(true)}>
                Reset to defaults
              </Button>
            </div>
          </aside>

          <aside className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">About</h2>
            <p className="text-tertiary text-caption mt-1">
              {APP_NAME} {APP_VERSION}
            </p>
            <p className="text-tertiary text-caption mt-0.5">Local-first. Your notes stay yours.</p>
          </aside>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* The categories. A navigation list, not tabs: it is vertical, it is
            long, and each entry is a section of a settings screen. */}
        <nav aria-label="Settings categories" className="lg:sticky lg:top-0 lg:self-start">
          <ul className="noto-scroll-x flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {CATEGORIES.map((entry) => {
              const isActive = entry.id === category;
              const Glyph = entry.icon;

              return (
                <li key={entry.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setCategory(entry.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'text-body-sm flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-medium transition-colors',
                      'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
                      isActive
                        ? 'bg-brand-soft text-brand-strong'
                        : 'text-secondary hover:bg-surface-secondary hover:text-primary',
                    )}
                  >
                    <Glyph
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-brand-hover' : 'text-tertiary',
                      )}
                    />
                    <span className="truncate">{entry.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {category === 'general' ? (
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
                control={
                  <Badge>{typeof navigator === 'undefined' ? 'System' : navigator.language}</Badge>
                }
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
          ) : null}

          {category === 'appearance' ? (
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
          ) : null}

          {category === 'editor' ? (
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
                      onChange={(event) =>
                        updateEditor({ lineHeight: Number(event.target.value) || 1.6 })
                      }
                    />
                  }
                />
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
          ) : null}

          {category === 'files' ? (
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
                description="Documents sit at the workspace root today. Folders arrive in the next release."
                control={<Badge>Coming soon</Badge>}
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
          ) : null}

          {category === 'autosave' ? (
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
                    onChange={(event) =>
                      updateEditor({ autoSaveDelayMs: Number(event.target.value) })
                    }
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
          ) : null}

          {category === 'memory' ? (
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
          ) : null}

          {category === 'clipboard' ? (
            <SettingsSection
              title="Clipboard"
              description="Clipboard history is part of Memory rather than a store of its own."
            >
              <SettingsRow
                label="Watch the clipboard"
                description="Requires the desktop background service."
                control={<Badge>Coming soon</Badge>}
              />
              <SettingsRow
                label="Quick Paste"
                description="Search everything captured and paste it without leaving the keyboard."
                control={<KeyHint keys={formatShortcut('CmdOrCtrl+Alt+V', platform)} />}
              />
            </SettingsSection>
          ) : null}

          {category === 'shortcuts' ? (
            <SettingsSection
              title="Keyboard shortcuts"
              description="Every command in Noto, and the keys bound to it."
            >
              <div className="max-h-[480px] overflow-y-auto">
                <ul className="divide-default divide-y">
                  {CORE_COMMANDS.filter((command) => command.shortcut).map((command) => (
                    <li
                      key={command.id}
                      className="flex items-center justify-between gap-4 px-5 py-2.5"
                    >
                      <span className="text-primary text-body-sm min-w-0 truncate">
                        {command.title}
                      </span>
                      <KeyHint keys={formatShortcut(command.shortcut!, platform)} />
                    </li>
                  ))}
                </ul>
              </div>
            </SettingsSection>
          ) : null}

          {category === 'ai' ? (
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
          ) : null}

          {category === 'privacy' ? (
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
          ) : null}

          {category === 'sync' ? (
            <SettingsSection
              title="Sync & Backup"
              description="Off by default. Noto is complete without it."
            >
              <SettingsRow
                label="Sync across devices"
                description="Queues local changes and sends them when a workspace is connected."
                control={
                  <Toggle
                    hideLabel
                    label="Sync across devices"
                    checked={settings.syncEnabled}
                    onChange={(enabled) => {
                      setSyncEnabled(enabled);
                      showToast(
                        enabled
                          ? 'Sync is on. Changes will queue until a workspace is connected.'
                          : 'Sync is off. Everything stays on this device.',
                      );
                    }}
                  />
                }
              />
              <SettingsRow
                label="Backup"
                description="Export a document as Markdown or JSON from its menu, any time."
                control={
                  <Button variant="secondary" size="sm" onClick={() => navigate('documents')}>
                    Export documents
                  </Button>
                }
              />
            </SettingsSection>
          ) : null}

          {category === 'updates' ? (
            <SettingsSection
              title="Updates"
              description="How Noto finds out about new releases, and what it does about them."
            >
              <SettingsRow
                label="Current version"
                description={
                  update.state === 'unsupported'
                    ? (update.message ?? 'This build of Noto does not update itself.')
                    : update.checkedAt
                      ? `Last checked ${relativeTime(update.checkedAt).toLowerCase()}.`
                      : 'Noto has not looked for a newer release yet this session.'
                }
                control={
                  <div className="flex items-center gap-2">
                    {isUpdateWaiting(update) ? (
                      <Badge tone="brand" dot>
                        {update.version} available
                      </Badge>
                    ) : (
                      <Badge>{APP_VERSION}</Badge>
                    )}
                    <Button
                      size="sm"
                      loading={update.state === 'checking' || update.state === 'downloading'}
                      onClick={() => void checkForUpdates({ manual: true })}
                    >
                      Check now
                    </Button>
                  </div>
                }
              />

              {/* Only shown when there is something to press. A permanent
                  "install" button with nothing to install is furniture. */}
              {isUpdateWaiting(update) ? (
                <SettingsRow
                  label={`${APP_NAME} ${update.version}`}
                  description={
                    update.state === 'ready'
                      ? 'Downloaded and waiting. Noto restarts to finish.'
                      : 'Published and ready to download.'
                  }
                  control={
                    <Button
                      variant="primary"
                      size="sm"
                      leading={<DownloadIcon className="h-4 w-4" />}
                      onClick={() => void installUpdate()}
                    >
                      {installLabel}
                    </Button>
                  }
                />
              ) : null}

              <SettingsRow
                label="Check for updates automatically"
                description="Asks GitHub for the newest release every few hours. This is the only thing Noto sends over the network on its own — switch it off and it never looks unless you press Check now."
                control={
                  <Toggle
                    hideLabel
                    label="Check for updates automatically"
                    checked={settings.updates.checkAutomatically}
                    onChange={(checked) => updatePreferences({ checkAutomatically: checked })}
                  />
                }
              />

              <SettingsRow
                label="Install updates automatically"
                description={
                  appliesOnRestart
                    ? 'A new version is installed the next time you open Noto, without asking. Off, Noto tells you it is ready and waits for you.'
                    : 'Noto in a browser cannot replace itself — reload the page to move to a new version. This is a desktop setting.'
                }
                control={
                  <Toggle
                    hideLabel
                    label="Install updates automatically"
                    disabled={!appliesOnRestart}
                    checked={appliesOnRestart && settings.updates.automatic}
                    onChange={(checked) => updatePreferences({ automatic: checked })}
                  />
                }
              />

              <SettingsRow
                label="Release notes"
                description="Every release, what changed in it, and the files it published."
                control={
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-strong text-body-sm focus-visible:outline-brand inline-flex items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Open on GitHub
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                }
              />
            </SettingsSection>
          ) : null}

          {category === 'about' ? (
            <SettingsSection title={`About ${APP_NAME}`}>
              <SettingsRow
                label="Version"
                description={
                  isUpdateWaiting(update) ? `${update.version} has been released.` : undefined
                }
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
          ) : null}

          {/* Settings apply as they are changed, so this is the only footer the
              screen needs — and it asks before undoing anything. */}
          <div className="border-default flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
            <p className="text-tertiary text-caption">
              Changes are saved on this device as you make them.
            </p>
            <Button variant="secondary" onClick={() => setResetting(true)}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetting}
        title="Reset settings?"
        confirmLabel="Reset to defaults"
        description={
          <>
            <p>Every setting goes back to how Noto ships: theme, editor, autosave and sync.</p>
            <p className="mt-2">Your documents are not touched.</p>
          </>
        }
        onConfirm={() => {
          reset();
          showToast('Settings reset to defaults', { tone: 'success' });
        }}
        onClose={() => setResetting(false)}
      />
    </PageContainer>
  );
}
