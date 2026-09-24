import { APP_NAME, APP_VERSION } from '@noto/config';
import { useSettingsStore } from '@noto/core';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showToast } from '../../components/toast-store';
import {
  ClipboardIcon,
  CloudIcon,
  DownloadIcon,
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
import { formatBytes } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { useAccount } from '../use-account';
import { useNotoData } from '../data-context';
import { navigate } from '../router';
import { useDocumentBytes } from '../settings/categories/use-document-bytes';
import { GeneralSettings } from '../settings/categories/GeneralSettings';
import { AppearanceSettings } from '../settings/categories/AppearanceSettings';
import { EditorSettings } from '../settings/categories/EditorSettings';
import { FilesSettings } from '../settings/categories/FilesSettings';
import { AutosaveSettings } from '../settings/categories/AutosaveSettings';
import { MemorySettings } from '../settings/categories/MemorySettings';
import { ClipboardSettings } from '../settings/categories/ClipboardSettings';
import { ShortcutsSettings } from '../settings/categories/ShortcutsSettings';
import { AiSettings } from '../settings/categories/AiSettings';
import { PrivacySettings } from '../settings/categories/PrivacySettings';
import { SyncSettings } from '../settings/categories/SyncSettings';
import { UpdatesSettings } from '../settings/categories/UpdatesSettings';
import { AboutSettings } from '../settings/categories/AboutSettings';

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
 * there is no Save button: the theme switch in the sidebar's footer applies
 * instantly, and one half of a settings screen that saves while the other half
 * does not is the kind of inconsistency people learn by losing work to. Reset
 * is the way back, and it asks first.
 *
 * The categories Noto has not built yet are still listed, and say what they
 * will control rather than showing switches that do nothing.
 */
export function SettingsScreen() {
  const reset = useSettingsStore((state) => state.reset);

  const { documents, workspace } = useNotoData();
  const { user, plan } = useAccount();

  const [category, setCategory] = useState<CategoryId>('general');
  const [resetting, setResetting] = useState(false);

  const usedBytes = useDocumentBytes();

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
          {category === 'general' ? <GeneralSettings /> : null}

          {category === 'appearance' ? <AppearanceSettings /> : null}

          {category === 'editor' ? <EditorSettings /> : null}

          {category === 'files' ? <FilesSettings /> : null}

          {category === 'autosave' ? <AutosaveSettings /> : null}

          {category === 'memory' ? <MemorySettings /> : null}

          {category === 'clipboard' ? <ClipboardSettings /> : null}

          {category === 'shortcuts' ? <ShortcutsSettings /> : null}

          {category === 'ai' ? <AiSettings /> : null}

          {category === 'privacy' ? <PrivacySettings /> : null}

          {category === 'sync' ? <SyncSettings /> : null}

          {category === 'updates' ? <UpdatesSettings /> : null}

          {category === 'about' ? <AboutSettings setCategory={setCategory} /> : null}

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
