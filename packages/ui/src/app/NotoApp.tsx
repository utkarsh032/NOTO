import { nextThemeMode, useSettingsStore, useUiStore } from '@noto/core';
import type { ThemeMode } from '@noto/types';
import { type ReactNode, useMemo } from 'react';

import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import {
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SidebarIcon,
  SunIcon,
  type IconProps,
} from '../components/icons';
import { WritingIllustration } from '../components/illustrations';
import { DocumentEditor } from './DocumentEditor';
import { Sidebar } from './Sidebar';
import { useNotoData } from './data-context';
import { useCommandShortcuts } from './use-command-shortcuts';
import { useResponsiveSidebar } from './use-responsive-sidebar';

/** What the theme control shows, and what it says it will do when pressed. */
const THEME_CONTROL: Record<
  ThemeMode,
  { icon: (props: IconProps) => ReactNode; label: string; next: string }
> = {
  light: { icon: SunIcon, label: 'Light', next: 'dark' },
  dark: { icon: MoonIcon, label: 'Dark', next: 'system' },
  system: { icon: MonitorIcon, label: 'System', next: 'light' },
};

/**
 * The Noto application shell, shared by the web and desktop applications.
 *
 * It reads everything it needs from the surrounding `NotoDataContext`, so the
 * two platforms differ only in how they store documents — not in how Noto looks
 * or behaves.
 */
export function NotoApp() {
  const { status, error, workspace, activeDocument, createDocument } = useNotoData();

  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const theme = useSettingsStore((state) => state.settings.appearance.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  /*
   * Shell-level accelerators. Save is deliberately absent: the editor binds it,
   * because the editor is what holds the unsaved draft.
   */
  const shortcutHandlers = useMemo(
    () => ({
      'document.new': () => void createDocument(),
      'view.toggleSidebar': toggleSidebar,
    }),
    [createDocument, toggleSidebar],
  );

  useCommandShortcuts(shortcutHandlers, {
    hasActiveDocument: Boolean(activeDocument),
    hasSelection: false,
    isEditable: Boolean(activeDocument),
  });

  useResponsiveSidebar();

  if (status === 'error') {
    return (
      <main className="bg-background flex h-full items-center justify-center">
        <ErrorState
          title="Noto could not open local storage"
          description={
            <>
              <p>{error ?? 'Local storage is unavailable.'}</p>
              <p className="mt-2">
                Nothing has been lost — documents already on this device stay where they are.
              </p>
            </>
          }
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          }
        />
      </main>
    );
  }

  if (status === 'loading') {
    /*
     * The shell is drawn in outline while storage opens, rather than held back
     * behind a spinner: the window it settles into is the one it starts in.
     */
    return (
      <div className="bg-background flex h-full" aria-busy="true">
        <div className="bg-surface-secondary border-default w-sidebar shrink-0 border-r p-3">
          <Skeleton className="mt-4 mb-6 h-6 w-24" />
          <Skeleton className="mb-4 h-10 w-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="px-2.5 py-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="max-w-editor mx-auto w-full px-4 pt-10 sm:px-8">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
        <span className="sr-only" role="status">
          Opening workspace
        </span>
      </div>
    );
  }

  /*
   * `undefined` means the selection is still resolving — a document that was
   * just created is briefly absent from the list. Render nothing in that window
   * rather than flashing the "create a document" prompt after every create.
   */
  let content: ReactNode = null;
  if (activeDocument) {
    // Keyed so switching documents remounts the editor with fresh state.
    content = <DocumentEditor key={activeDocument.id} document={activeDocument} />;
  } else if (activeDocument === null) {
    content = (
      <EmptyState
        title="Nothing open"
        description="Select a document, or create a new one to start writing."
        illustration={<WritingIllustration />}
        action={
          <Button
            variant="primary"
            onClick={() => void createDocument()}
            leading={<PlusIcon className="h-5 w-5" />}
          >
            New document
          </Button>
        }
        className="h-full"
      />
    );
  }

  const themeControl = THEME_CONTROL[theme];
  const ThemeIcon = themeControl.icon;

  return (
    <div className="bg-background flex h-full">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Same height as the sidebar's brand bar, so the rule under the two
            of them is a single unbroken line across the window. */}
        <header className="border-default bg-background h-header flex shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* The expanded sidebar carries its own collapse control, so this
                only appears when there is no other way back. */}
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand -ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                <SidebarIcon className="h-5 w-5" />
              </button>
            ) : null}

            {/*
             * Where the open document lives. The document's own title is
             * deliberately not repeated here: the editor holds it in local
             * state until autosave runs, so a breadcrumb reading it from the
             * store would say "Untitled" over a title the user has just typed.
             */}
            {workspace && activeDocument ? (
              <p className="text-secondary text-body-sm min-w-0 truncate">{workspace.name}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setTheme(nextThemeMode(theme))}
            aria-label={`Appearance: ${themeControl.label}. Switch to ${themeControl.next}.`}
            title={`Appearance: ${themeControl.label}`}
            className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            <ThemeIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      </main>
    </div>
  );
}
