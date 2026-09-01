import {
  clampZoom,
  contentFromPlainText,
  formatShortcut,
  nextThemeMode,
  useSettingsStore,
  useUiStore,
  zoomIn,
  zoomOut,
} from '@noto/core';
import type { ThemeMode } from '@noto/types';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { Skeleton } from '../components/Skeleton';
import { ToastViewport } from '../components/Toast';
import { showToast } from '../components/toast-store';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { NotoAppShell } from './NotoAppShell';
import { Sidebar } from './Sidebar';
import { HomeScreen } from './screens/HomeScreen';
import { QuickNoteDock } from './dock/QuickNoteDock';
import { readDockPlacement, setDockEnabled } from './dock/dock-placement';
import { CommandPalette } from './overlays/CommandPalette';
import { FloatingNoto } from './overlays/FloatingNoto';
import { QuickNote } from './overlays/QuickNote';
import { QuickPaste } from './overlays/QuickPaste';
import { ShortcutsDialog } from './overlays/ShortcutsDialog';
import { SmartSidebar } from './overlays/SmartSidebar';
import { UpdateDialog } from './overlays/UpdateDialog';
import { subscribeToAppCommands } from './app-commands';
import { useNotoData } from './data-context';
import { quickNoteTitle } from './quick-note-draft';
import { navigate } from './router';
import { useAccount } from './use-account';
import { useCommandShortcuts, detectShortcutPlatform } from './use-command-shortcuts';
import { useDocumentTabs } from './use-document-tabs';
import { useNotoActions } from './use-noto-actions';
import { useResponsiveSidebar } from './use-responsive-sidebar';
import { useRoute } from './use-route';
import { useUpdateWatcher, checkForUpdates } from './updates';
import { useViewport } from './use-viewport';

/*
 * Every screen but Home is a chunk of its own.
 *
 * Home is what Noto opens on, so it is part of the shell; the workspace brings
 * the whole editor with it, and settings, memory, search and the account screen
 * are each a page most sessions never visit. Loading them on the click that
 * asks for them is the difference between a fast start and a bundle that grows
 * every time a screen is added.
 */
const WorkspaceScreen = lazy(() =>
  import('./screens/WorkspaceScreen').then((module) => ({ default: module.WorkspaceScreen })),
);
const DocumentsScreen = lazy(() =>
  import('./screens/DocumentsScreen').then((module) => ({ default: module.DocumentsScreen })),
);
const QuickNoteScreen = lazy(() =>
  import('./screens/QuickNoteScreen').then((module) => ({ default: module.QuickNoteScreen })),
);
const MemoryScreen = lazy(() =>
  import('./screens/MemoryScreen').then((module) => ({ default: module.MemoryScreen })),
);
const SearchScreen = lazy(() =>
  import('./screens/SearchScreen').then((module) => ({ default: module.SearchScreen })),
);
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })),
);
const AccountScreen = lazy(() =>
  import('./screens/AccountScreen').then((module) => ({ default: module.AccountScreen })),
);
const PlansScreen = lazy(() =>
  import('./screens/PlansScreen').then((module) => ({ default: module.PlansScreen })),
);
const LoginScreen = lazy(() =>
  import('./screens/LoginScreen').then((module) => ({ default: module.LoginScreen })),
);

/** Which overlay is up. Only one of the modal ones can be at a time. */
interface Overlays {
  palette: boolean;
  quickNote: boolean;
  quickPaste: boolean;
  shortcuts: boolean;
  floating: boolean;
  smartSidebar: boolean;
}

const NO_OVERLAYS: Overlays = {
  palette: false,
  quickNote: false,
  quickPaste: false,
  shortcuts: false,
  floating: false,
  smartSidebar: false,
};

/**
 * The Noto application, shared by web and desktop.
 *
 * It reads everything it needs from the surrounding `NotoDataContext`, so the
 * two platforms differ only in how they store documents — not in how Noto looks
 * or behaves.
 *
 * Its own job is small and worth keeping small: hold the route, hold which
 * overlays are open, and bind the accelerators that belong to the window rather
 * than to the document. Each screen owns everything else about itself.
 */
export function NotoApp() {
  const { status, error, activeDocument, documents } = useNotoData();
  const route = useRoute();
  const viewport = useViewport();
  const { user } = useAccount();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();

  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const theme = useSettingsStore((state) => state.settings.appearance.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const editorSettings = useSettingsStore((state) => state.settings.editor);
  const updateEditor = useSettingsStore((state) => state.updateEditor);

  const [overlays, setOverlays] = useState<Overlays>(NO_OVERLAYS);

  const platform = useMemo(() => detectShortcutPlatform(), []);

  const show = useCallback((which: keyof Overlays) => {
    setOverlays((current) => ({ ...NO_OVERLAYS, ...current, [which]: true }));
  }, []);

  const hide = useCallback((which: keyof Overlays) => {
    setOverlays((current) => ({ ...current, [which]: false }));
  }, []);

  /*
   * Save All flushes every mounted editor. Only the front tab is mounted today,
   * so it flushes one — but it is the editors that hold unwritten work, not the
   * shell, and asking them is the arrangement that keeps working when a split
   * view mounts two.
   */
  const flushRef = useRef(new Map<string, () => void>());

  const registerFlush = useCallback((documentId: string, flush: (() => void) | null) => {
    if (flush) flushRef.current.set(documentId, flush);
    else flushRef.current.delete(documentId);
  }, []);

  const saveAll = useCallback(() => {
    for (const flush of flushRef.current.values()) flush();
  }, []);

  const activeDocumentId = activeDocument?.id ?? null;
  const zoom = clampZoom(editorSettings.zoom);

  /** The dock's Save: the same thing the Quick Note window does with a draft. */
  const saveDockNote = useCallback(
    async (text: string) => {
      await actions.importDocument({
        title: quickNoteTitle(text),
        content: contentFromPlainText(text),
      });
      showToast('Saved as a document', { tone: 'success' });
    },
    [actions],
  );

  /*
   * Shell-level accelerators. Save is deliberately absent: the editor binds it,
   * because the editor is what holds the unsaved draft.
   */
  const commandHandlers = useMemo(
    () => ({
      'document.new': () => void tabs.create().then(() => navigate('workspace')),
      'document.saveAll': saveAll,
      'document.close': () => {
        if (activeDocumentId) tabs.close(activeDocumentId);
      },
      'document.closeAll': tabs.closeAll,

      'view.toggleSidebar': toggleSidebar,
      'view.zoomIn': () => updateEditor({ zoom: zoomIn(zoom) }),
      'view.zoomOut': () => updateEditor({ zoom: zoomOut(zoom) }),
      'view.zoomReset': () => updateEditor({ zoom: 1 }),
      'view.toggleWordWrap': () => updateEditor({ wordWrap: !editorSettings.wordWrap }),
      'view.toggleInvisibles': () =>
        updateEditor({ showInvisibles: !editorSettings.showInvisibles }),
      'view.toggleTheme': () => setTheme(nextThemeMode(theme)),

      'navigation.commandPalette': () => show('palette'),
      'navigation.home': () => navigate('home'),
      'navigation.workspace': () => navigate('workspace'),
      'navigation.documents': () => navigate('documents'),
      'navigation.quickNotes': () => navigate('quick-note'),
      'navigation.memory': () => navigate('memory'),
      'navigation.search': () => navigate('search'),
      'navigation.account': () => navigate('account'),
      'navigation.plans': () => navigate('plans'),
      'navigation.signIn': () => navigate('login'),

      'app.quickNote': () => show('quickNote'),
      'app.quickPaste': () => show('quickPaste'),
      'app.floatingNoto': () => show('floating'),
      'app.smartSidebar': () => show('smartSidebar'),
      /*
       * The dock is a preference rather than an overlay — it is meant to still
       * be there tomorrow — so this writes the flag and the dock follows.
       */
      'app.toggleDock': () => {
        const next = !readDockPlacement().enabled;
        setDockEnabled(next);
        showToast(
          next ? 'Quick Note dock is on the edge of the window.' : 'Quick Note dock hidden.',
        );
      },
      'app.aiAssistant': () => {
        navigate('workspace');
        showToast('Noto AI is in the panel beside the document.');
      },
      'app.shortcuts': () => show('shortcuts'),
      'app.settings': () => navigate('settings'),
      'app.checkForUpdates': () => void checkForUpdates({ manual: true }),
    }),
    [
      tabs,
      saveAll,
      activeDocumentId,
      toggleSidebar,
      updateEditor,
      zoom,
      editorSettings.wordWrap,
      editorSettings.showInvisibles,
      setTheme,
      theme,
      show,
    ],
  );

  const commandContext = useMemo(
    () => ({
      hasActiveDocument: Boolean(activeDocument),
      hasSelection: false,
      isEditable: Boolean(activeDocument),
    }),
    [activeDocument],
  );

  useCommandShortcuts(commandHandlers, commandContext);
  useResponsiveSidebar();
  useUpdateWatcher();

  /*
   * The same table, driven from outside the window. On the desktop, Quick Note
   * is a global accelerator: the key press lands in the main process while
   * another application has focus, and arrives here as a command id.
   */
  useEffect(
    () =>
      subscribeToAppCommands((commandId, argument) => {
        /* The one command that needs to name something: the dock lists recent
           documents, and "open that one" is not a command id. */
        if (commandId === 'navigation.openDocument') {
          if (argument) actions.openDocument(argument);
          return;
        }

        commandHandlers[commandId as keyof typeof commandHandlers]?.();
      }),
    [commandHandlers, actions],
  );

  const recentForDock = useMemo(
    () =>
      [...(documents ?? [])]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 4)
        .map((document) => ({
          id: document.id,
          title: document.title,
          updatedAt: document.updatedAt,
        })),
    [documents],
  );

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
   * Sign-in is the one route that replaces the window rather than filling the
   * pane in it. A shell full of somebody's documents behind a sign-in form is a
   * shell belonging to a person who is, by definition, not signed in.
   */
  if (route.name === 'login') {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <LoginScreen />
        <ToastViewport />
      </Suspense>
    );
  }

  const isMobile = viewport === 'mobile';

  return (
    <>
      <NotoAppShell
        sidebar={
          isMobile ? null : (
            <Sidebar
              route={route}
              onQuickNote={() => show('quickNote')}
              quickNoteShortcut={formatShortcut('CmdOrCtrl+Alt+N', platform)}
            />
          )
        }
        header={
          <Header
            user={user}
            theme={theme}
            onTheme={(mode: ThemeMode) => setTheme(mode)}
            onSearch={() => show('palette')}
            searchShortcut={formatShortcut('CmdOrCtrl+K', platform)}
            onOpenAccount={() => navigate('account')}
            onOpenSettings={() => navigate('settings')}
            onOpenShortcuts={() => show('shortcuts')}
            onOpenPlans={() => navigate('plans')}
            onSignOut={() => navigate('login')}
            compact={isMobile}
            notificationCount={0}
          />
        }
        bottomNav={
          isMobile ? <MobileNav route={route} onQuickNote={() => show('quickNote')} /> : null
        }
      >
        {route.name === 'home' ? (
          <HomeScreen
            onQuickNote={() => show('quickNote')}
            onQuickPaste={() => show('quickPaste')}
          />
        ) : null}

        {/*
         * One boundary around the lazy screens, keyed by route so that moving
         * between two of them shows the placeholder rather than holding the
         * previous screen on screen while the next one arrives.
         */}
        <Suspense key={route.name} fallback={<ScreenLoading />}>
          {route.name === 'workspace' ? (
            <WorkspaceScreen
              documentId={route.param}
              onRegisterFlush={registerFlush}
              onShortcuts={() => show('shortcuts')}
            />
          ) : null}

          {route.name === 'documents' ? <DocumentsScreen /> : null}
          {route.name === 'quick-note' ? (
            <QuickNoteScreen
              onQuickNote={() => show('quickNote')}
              onShowDock={() => {
                setDockEnabled(true);
                showToast('Quick Note dock is on the edge of the window.');
              }}
            />
          ) : null}
          {route.name === 'memory' ? <MemoryScreen kind={route.param} /> : null}
          {route.name === 'search' ? (
            <SearchScreen
              query={route.param}
              onAskAI={() => {
                navigate('workspace');
                showToast('Noto AI is in the panel beside the document.');
              }}
            />
          ) : null}
          {route.name === 'settings' ? <SettingsScreen /> : null}
          {route.name === 'account' ? <AccountScreen /> : null}
          {route.name === 'plans' ? <PlansScreen /> : null}
        </Suspense>
      </NotoAppShell>

      {/*
       * Overlays live outside the shell so nothing about the layout can clip
       * them, and so a dialog is never a child of the pane it is about.
       */}
      <CommandPalette
        open={overlays.palette}
        onClose={() => hide('palette')}
        onRunCommand={(commandId) => commandHandlers[commandId as keyof typeof commandHandlers]?.()}
        context={commandContext}
      />

      <QuickNote open={overlays.quickNote} onClose={() => hide('quickNote')} />
      <QuickPaste open={overlays.quickPaste} onClose={() => hide('quickPaste')} />
      <ShortcutsDialog open={overlays.shortcuts} onClose={() => hide('shortcuts')} />

      <FloatingNoto
        open={overlays.floating}
        onClose={() => hide('floating')}
        onQuickNote={() => show('quickNote')}
        onQuickPaste={() => show('quickPaste')}
        onAskAI={() => {
          hide('floating');
          navigate('workspace');
        }}
      />

      <SmartSidebar
        open={overlays.smartSidebar}
        onClose={() => hide('smartSidebar')}
        onQuickNote={() => show('quickNote')}
        onQuickPaste={() => show('quickPaste')}
        onSearch={() => show('palette')}
        onAskAI={() => {
          hide('smartSidebar');
          navigate('workspace');
        }}
      />

      {/*
       * The dock. On a phone the bottom bar already has Quick Note in it, and a
       * tab on the edge of a screen that size is a tab over the content.
       */}
      {isMobile ? null : (
        <QuickNoteDock
          onSave={saveDockNote}
          onOpenNoto={() => navigate('quick-note')}
          onQuickPaste={() => show('quickPaste')}
          onSearch={() => show('palette')}
          onAskAI={() => {
            navigate('workspace');
            showToast('Noto AI is in the panel beside the document.');
          }}
          recent={recentForDock}
          onOpenRecent={(id) => actions.openDocument(id)}
        />
      )}

      <UpdateDialog />

      <ToastViewport />
    </>
  );
}

/**
 * What fills the pane while a screen's chunk is fetched.
 *
 * The shell is already on screen by then — sidebar, header and all — so this is
 * only ever the content area, and it holds the page's shape so nothing under
 * the pointer moves when the screen lands.
 */
function ScreenLoading() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto w-full px-5 py-6 sm:px-8 sm:py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8">
          <LoadingState label="Opening" rows={5} />
        </div>
      </div>
    </main>
  );
}
