import { formatShortcut, useUiStore } from '@noto/core';
import { useMemo } from 'react';

import { Dropdown, type DropdownItem } from '../components/Dropdown';
import { IconButton } from '../components/IconButton';
import { KeyHint } from '../components/KeyHint';
import {
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  ExportIcon,
  FolderOpenIcon,
  KeyboardIcon,
  MoreIcon,
  PanelRightIcon,
  PlusIcon,
  PrinterIcon,
  SidebarIcon,
} from '../components/icons';
import { TabBar } from './TabBar';
import { emitAppCommand } from './app-commands';
import { clearRecentFiles, useRecentFiles } from './local-file';
import { useNotoData } from './data-context';
import { useDocumentOperations } from './documents/use-document-operations';
import { routeTitle } from './navigation';
import { printDocument } from './print';
import type { Route } from './router';
import { useDocumentTabs } from './use-document-tabs';
import { detectShortcutPlatform } from './use-command-shortcuts';
import { useNotoActions } from './use-noto-actions';

export interface AppHeaderProps {
  route: Route;
  onShortcuts(): void;
}

/**
 * The header: the open documents, and what to do with the one in front.
 *
 * There is no separate application bar above this any more. Search, appearance
 * and the account all moved into the sidebar — they are about the person and
 * their whole workspace, which is what the sidebar is for — and what is left at
 * the top of the window is the one thing that describes the pane underneath it.
 *
 * The strip keeps its height whether or not anything is open. With documents,
 * it is the tabs; without them, it names the screen instead of collapsing —
 * a bar that appears on the first document is a layout that jumps under the
 * pointer at the worst possible moment, and a window with no title anywhere is
 * a window you have to look at twice to place.
 *
 * The workspace's own controls ride along on the right and only on the
 * workspace, because they act on the document the tabs are pointing at. The
 * context panel's open state is in the shared UI store rather than in the
 * screen: the button is here, the panel is down there, and one answer between
 * them is the only arrangement where the two cannot disagree.
 */
export function AppHeader({ route, onShortcuts }: AppHeaderProps) {
  const { activeDocument } = useNotoData();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();
  const operations = useDocumentOperations();

  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const panelOpen = useUiStore((state) => state.contextPanelOpen);
  const toggleContextPanel = useUiStore((state) => state.toggleContextPanel);

  const isWorkspace = route.name === 'workspace';

  const recent = useRecentFiles();
  const platform = useMemo(() => detectShortcutPlatform(), []);

  /*
   * The file menu.
   *
   * Everything here goes out on the command bus rather than being called on the
   * spot. Open belongs to the shell, which owns making documents; Save belongs
   * to the editor, which holds the draft being saved; Recent belongs to the
   * shell again, because reopening a file is making a document. None of them is
   * reachable from a header, and all of them answer to the same command id the
   * palette and the accelerator use — so a menu entry cannot come to mean
   * something else.
   *
   * The accelerators are shown the way a file menu has always shown them. They
   * are read from the registry rather than typed here, so a key that changes
   * changes in one place.
   */
  const fileMenu = useMemo((): DropdownItem[] => {
    const hint = (shortcut: string) => <KeyHint keys={formatShortcut(shortcut, platform)} />;

    return [
      {
        id: 'new',
        label: 'New document',
        icon: <DocumentIcon className="h-4 w-4" />,
        trailing: hint('CmdOrCtrl+N'),
        onSelect: () => emitAppCommand('document.new'),
      },
      {
        id: 'open',
        label: 'Open file…',
        icon: <FolderOpenIcon className="h-4 w-4" />,
        trailing: hint('CmdOrCtrl+O'),
        onSelect: () => emitAppCommand('document.open'),
      },

      /*
       * The files this machine has been in lately, newest first. Five of them:
       * enough to hold a morning's work, few enough that the menu underneath is
       * still findable. A file already open comes back as its own tab rather
       * than as a copy — the shell settles that, because it is the side that
       * knows which documents exist.
       */
      ...recent.slice(0, 5).map((file, index) => ({
        id: `recent-${file.ref}`,
        label: file.name,
        icon: index === 0 ? <ClockIcon className="h-4 w-4" /> : undefined,
        separated: index === 0,
        onSelect: () => emitAppCommand('document.openRecent', file.ref),
      })),
      ...(recent.length > 0
        ? [
            {
              id: 'recent-clear',
              label: 'Clear recent files',
              onSelect: clearRecentFiles,
            },
          ]
        : []),

      {
        id: 'save',
        label: 'Save',
        icon: <DownloadIcon className="h-4 w-4" />,
        trailing: hint('CmdOrCtrl+S'),
        separated: true,
        disabled: !activeDocument,
        onSelect: () => emitAppCommand('document.save'),
      },
      {
        id: 'save-as',
        label: 'Save as…',
        trailing: hint('CmdOrCtrl+Shift+S'),
        disabled: !activeDocument,
        onSelect: () => emitAppCommand('document.saveAs'),
      },
      {
        id: 'save-all',
        label: 'Save all',
        trailing: hint('CmdOrCtrl+Alt+S'),
        disabled: !activeDocument,
        onSelect: () => emitAppCommand('document.saveAll'),
      },

      {
        id: 'export',
        label: 'Export…',
        icon: <ExportIcon className="h-4 w-4" />,
        separated: true,
        disabled: !activeDocument,
        onSelect: () => {
          if (activeDocument) operations.exportDocument(activeDocument);
        },
      },
      {
        id: 'print',
        label: 'Print…',
        icon: <PrinterIcon className="h-4 w-4" />,
        trailing: hint('CmdOrCtrl+P'),
        disabled: !activeDocument,
        onSelect: () => void printDocument(),
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        icon: <KeyboardIcon className="h-4 w-4" />,
        separated: true,
        onSelect: onShortcuts,
      },
    ];
  }, [activeDocument, onShortcuts, operations, platform, recent]);

  return (
    <>
      {/* The bar carries the sidebar's fill rather than the document's, so the
          chrome reads as one band across the top of the window and the open
          tab — which is the document's colour — stands out of it. The left
          inset clears the sidebar's collapse handle, half of which overhangs
          the divider into this bar. */}
      <header className="noto-print-hidden border-default bg-surface-secondary h-header flex shrink-0 items-stretch gap-2 border-b pr-2 pl-5 sm:pr-3">
        {tabs.tabs.length > 0 ? (
          <TabBar
            tabs={tabs.tabs}
            /*
             * Opening, not merely selecting. The strip is above every screen
             * now, so a click here has to be able to leave the one you are on;
             * `tabs.open` alone would change which document is current and
             * leave you looking at Settings. This is the same action every
             * document row in the sidebar already uses.
             */
            onSelect={actions.openDocument}
            onClose={tabs.close}
            onNew={() => void actions.newDocument()}
            className="min-w-0 flex-1"
          />
        ) : (
          /*
           * The screen's own name, in the space the tabs would occupy — a
           * label rather than a heading. Every screen already renders its own
           * `h1`, and a second one in the chrome would leave two of them
           * disagreeing about what the page is called.
           */
          <p className="text-primary text-body-sm flex min-w-0 flex-1 items-center truncate font-semibold">
            {routeTitle(route)}
          </p>
        )}

        {/* On the tabs' own line: everything here acts on the document the row
            beside it names. */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* Only while the strip is not showing. With tabs open, New lives
              after the last one, where a tabbed thing puts it — two of them on
              screen at once would be one too many. */}
          {tabs.tabs.length === 0 ? (
            <IconButton
              label="New document"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => void actions.newDocument()}
              variant="surface"
              size="sm"
            />
          ) : null}

          {isWorkspace ? (
            <>
              {/* The two panels, as one pair: what they do is the same thing to
                  opposite edges of the window. */}
              <div className="border-default ml-1 hidden items-center rounded-md border lg:flex">
                <IconButton
                  label="Toggle sidebar"
                  icon={<SidebarIcon className="h-4 w-4" />}
                  onClick={toggleSidebar}
                  size="sm"
                  className="rounded-r-none"
                />
                <span className="bg-default h-5 w-px" aria-hidden="true" />
                <IconButton
                  label={panelOpen ? 'Hide document details' : 'Show document details'}
                  icon={<PanelRightIcon className="h-4 w-4" />}
                  isActive={panelOpen}
                  disabled={!activeDocument}
                  onClick={toggleContextPanel}
                  size="sm"
                  className="rounded-l-none"
                />
              </div>

              <Dropdown
                label="Document menu"
                items={fileMenu}
                trigger={(triggerProps) => (
                  <IconButton
                    {...triggerProps}
                    label="Document menu"
                    icon={<MoreIcon className="h-5 w-5" />}
                    size="sm"
                  />
                )}
              />
            </>
          ) : null}
        </div>
      </header>

      {/* The export dialog the menu above opens. Modal and fixed, so it belongs
          beside the header rather than inside a bar that clips its contents. */}
      {operations.dialogs}
    </>
  );
}
