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
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { Skeleton } from '../components/Skeleton';
import { ToastViewport } from '../components/Toast';
import { showToast } from '../components/toast-store';
import { AppHeader } from './AppHeader';
import { MobileHeader } from './MobileHeader';
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
import { emitAppCommand, subscribeToAppCommands } from './app-commands';
import { useNotoData } from './data-context';
import { parseImportedFile } from './export';
import {
  documentForFile,
  forgetRecentFile,
  linkFile,
  openFilesFromDisk,
  readRecentFile,
  recentFiles,
  type OpenedFile,
} from './local-file';
import { quickNoteTitle } from './quick-note-draft';
import { navigate } from './router';
import { useAccount } from './use-account';
import { useRouteGuard } from './use-route-guard';
import { useSignOut } from './use-sign-out';
import { claimFirstLaunch } from './welcome';
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
  const { signOut: handleSignOut } = useSignOut();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();

  /*
   * Nothing renders a screen the account does not entitle it to. One place
   * decides, and both the private screen and the sign-in screen read the same
   * answer — see `use-route-guard.ts` for why it has three of them.
   */
  const verdict = useRouteGuard(route);
  const guarded = verdict !== 'allow';

  /*
   * First launch opens on the sign-in screen, once. Noto works signed out and
   * "Continue without an account" is right there, so this is an introduction
   * rather than a gate — but somebody who has never seen it cannot know an
   * account is on offer, and Home does not tell them.
   */
  useEffect(() => {
    if (claimFirstLaunch()) navigate('login');
  }, []);

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
   * Open, the way Notepad means it: files off the disk, each into a document of
   * its own, and the first of them in front. Each document remembers the file
   * it came from, so Save writes back there rather than asking where.
   *
   * The documents are created through the same import path the Documents
   * screen uses, so a file opened this way is an ordinary document from the
   * moment it exists — searchable, synced, in the sidebar — with one extra fact
   * about it kept on this machine.
   */
  /**
   * Turns files that have been read into documents, and puts the first in front.
   *
   * Shared by Open and by Recent, because the two differ only in how the file
   * was chosen: everything after the bytes arrive is the same, down to what is
   * said about it.
   */
  const adoptFiles = useCallback(
    async (opened: OpenedFile[]) => {
      let first: string | null = null;

      for (const { file, text } of opened) {
        const id = await actions.importDocument(parseImportedFile(file.name, text));
        if (!id) continue;

        linkFile(id, file);
        first ??= id;
      }

      if (!first) {
        showToast('Noto could not open those files. Nothing was changed.', { tone: 'error' });
        return;
      }

      actions.openDocument(first);
      showToast(
        opened.length === 1 ? `Opened ${opened[0]!.file.name}` : `Opened ${opened.length} files`,
        { tone: 'success' },
      );
    },
    [actions],
  );

  /**
   * True while the workspace is still opening.
   *
   * Nothing can be made of a file until storage is open, and a picker shown
   * before then ends with the user choosing a file that is quietly dropped. The
   * window is short — a skeleton is on screen for it — but "I opened it and it
   * vanished" is the worst way to learn that.
   */
  const notReadyYet = useCallback(() => {
    if (status === 'ready') return false;

    showToast('Noto is still opening your workspace. Try again in a moment.');
    return true;
  }, [status]);

  const openFromDisk = useCallback(async () => {
    if (notReadyYet()) return;

    let opened: OpenedFile[] | null;
    try {
      opened = await openFilesFromDisk();
    } catch (error) {
      showToast(
        error instanceof Error && error.message ? error.message : 'Noto could not open that file.',
        { tone: 'error' },
      );
      return;
    }

    if (!opened || opened.length === 0) return;

    await adoptFiles(opened);
  }, [adoptFiles, notReadyYet]);

  /*
   * Recent: a file the user chose once, opened again without finding it twice.
   *
   * A file that is already a document here comes back as that document rather
   * than as a second copy of itself — the tab, the edits and the history are
   * the reason somebody is reaching for it. Only a file Noto has lost track of
   * is read afresh, and one it cannot read at all leaves the list, because a
   * menu entry that can only ever apologise is worse than no entry.
   */
  const openRecent = useCallback(
    async (ref: string) => {
      if (notReadyYet()) return;

      const existing = documentForFile(ref);
      if (existing && (documents ?? []).some((document) => document.id === existing)) {
        actions.openDocument(existing);
        return;
      }

      const file = recentFiles().find((entry) => entry.ref === ref);
      if (!file) return;

      try {
        await adoptFiles([await readRecentFile(file)]);
      } catch (error) {
        forgetRecentFile(ref);
        showToast(
          error instanceof Error && error.message
            ? error.message
            : `Noto could not open ${file.name}.`,
          { tone: 'error' },
        );
      }
    },
    [actions, adoptFiles, documents, notReadyYet],
  );

  /*
   * Shell-level accelerators. Save and Save As are deliberately absent: the
   * editor binds them, because the editor is what holds the unsaved draft.
   * Open is here because it makes documents, which is the shell's business.
   */
  const commandHandlers = useMemo(
    () => ({
      'document.new': () => void tabs.create().then(() => navigate('workspace')),
      'document.open': () => void openFromDisk(),
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
      openFromDisk,
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

        /* The other one: which file to reopen, named by the menu that listed it. */
        if (commandId === 'document.openRecent') {
          if (argument) void openRecent(argument);
          return;
        }

        commandHandlers[commandId as keyof typeof commandHandlers]?.();
      }),
    [commandHandlers, actions, openRecent],
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
    /*
     * Already signed in, and the guard is on its way to moving them along. A
     * sign-in form painted for the one frame in between is a form nobody
     * asked for.
     */
    if (guarded) return <WindowLoading />;

    return (
      <Suspense fallback={<ScreenLoading />}>
        <LoginScreen />
        <ToastViewport />
      </Suspense>
    );
  }

  const isMobile = viewport === 'mobile';

  /*
   * Who is signed in, and the four screens behind the avatar. The sidebar
   * carries the menu on a desktop and the top bar carries it on a phone, so it
   * is gathered once here rather than written out twice.
   *
   * Appearance is not in here. Only the sidebar shows that switch — a phone
   * changes its theme in Settings — and bundling it would hand the phone bar
   * two props it does not accept.
   */
  const accountProps = {
    user,
    onOpenAccount: () => navigate(user ? 'account' : 'login'),
    onOpenSettings: () => navigate('settings'),
    onOpenShortcuts: () => show('shortcuts'),
    onOpenPlans: () => navigate('plans'),
    onSignOut: handleSignOut,
  };

  return (
    <>
      <NotoAppShell
        sidebar={
          isMobile ? null : (
            <Sidebar
              route={route}
              onQuickNote={() => show('quickNote')}
              quickNoteShortcut={formatShortcut('CmdOrCtrl+Alt+N', platform)}
              onSearch={() => show('palette')}
              searchShortcut={formatShortcut('CmdOrCtrl+K', platform)}
              theme={theme}
              onTheme={setTheme}
              {...accountProps}
            />
          )
        }
        /*
         * Two different bars, because the two shapes have different problems.
         * On a desktop the header is the open documents; on a phone there is no
         * sidebar to have moved search and the account into, so the top bar is
         * where those two stayed.
         */
        header={
          isMobile ? (
            <MobileHeader onSearch={() => show('palette')} {...accountProps} />
          ) : (
            <AppHeader route={route} onShortcuts={() => show('shortcuts')} />
          )
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
          {/*
           * A guarded route gets the placeholder instead of its screen. `wait`
           * is a session still coming back and `redirecting` is the frame
           * before the hash changes; painting the screen through either one is
           * how a private page ends up on screen for somebody without it.
           */}
          {guarded ? <ScreenLoading /> : null}

          {guarded ? null : (
            <>
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
            </>
          )}
        </Suspense>
      </NotoAppShell>

      {/*
       * Overlays live outside the shell so nothing about the layout can clip
       * them, and so a dialog is never a child of the pane it is about.
       */}
      <CommandPalette
        open={overlays.palette}
        onClose={() => hide('palette')}
        onRunCommand={(commandId) => {
          /*
           * What the shell has no handler for belongs to a screen — Save, Print
           * and Find are the editor's, because the editor holds the draft. They
           * go out on the command bus, and whichever editor is in front answers.
           */
          const handler = commandHandlers[commandId as keyof typeof commandHandlers];
          if (handler) handler();
          else emitAppCommand(commandId);
        }}
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
 * What fills the window while the guard decides, on the routes that render
 * without the shell around them.
 *
 * Deliberately almost nothing. It is on screen for a frame or two — long
 * enough that the window is never blank, short enough that anything more
 * would be a flash of interface that then goes away.
 */
function WindowLoading() {
  return (
    <div className="bg-background flex h-full items-center justify-center" aria-busy="true">
      <span className="sr-only" role="status">
        Checking your account
      </span>
    </div>
  );
}

/**
 * What fills the pane while a screen's chunk is fetched.
 *
 * The shell is already on screen by then — sidebar, tabs and all — so this is
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
