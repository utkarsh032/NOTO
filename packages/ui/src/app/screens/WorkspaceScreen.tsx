import { clampZoom, plainTextFromContent, useSettingsStore, useTabsStore } from '@noto/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { PanelRightIcon, PlusIcon } from '../../components/icons';
import { WritingIllustration } from '../../components/illustrations';
import { DocumentEditor, type SaveState } from '../DocumentEditor';
import { EditorScrollArea } from '../EditorScrollArea';
import { TabBar } from '../TabBar';
import { ContextPanel, type ContextTab } from '../editor/ContextPanel';
import { EditorStatusBar } from '../editor/EditorStatusBar';
import { useNotoData } from '../data-context';
import { replaceRoute } from '../router';
import { useDocumentTabs } from '../use-document-tabs';
import { useNotoActions } from '../use-noto-actions';

export interface WorkspaceScreenProps {
  /** The document id from the URL, when the workspace was reached by link. */
  documentId?: string;
  /** Registers an editor's flush function with the shell, for Save All. */
  onRegisterFlush(documentId: string, flush: (() => void) | null): void;
  onShortcuts(): void;
}

/**
 * The workspace: tabs, the document, and what is beside it.
 *
 * This is the screen Noto exists for, so the arrangement is deliberately plain
 * — a strip of tabs, the page, a line of facts underneath — and everything that
 * is not the document either scrolls away with it or sits quietly at an edge.
 */
export function WorkspaceScreen({
  documentId,
  onRegisterFlush,
  onShortcuts,
}: WorkspaceScreenProps) {
  const { activeDocument, workspace } = useNotoData();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();

  const zoom = useSettingsStore((state) => clampZoom(state.settings.editor.zoom));

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<ContextTab>('outline');
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const activeId = activeDocument?.id ?? null;

  /*
   * Which document is open and what the address says are kept in step in one
   * direction each, and both against the tab store rather than against each
   * other.
   *
   * The tab store is the authority: it is what a click on a tab, on a sidebar
   * row or on a search result updates, and it updates synchronously. The
   * document the editor is rendering follows it a beat later, through the data
   * source — so an address compared against *that* is briefly out of date, and
   * two effects comparing against it end up undoing each other's work.
   */
  const activeTabId = useTabsStore((state) => state.activeId);

  /* A link into the workspace opens the document it names, once per address. */
  const appliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!documentId || appliedRef.current === documentId) return;

    appliedRef.current = documentId;
    if (documentId !== useTabsStore.getState().activeId) tabs.open(documentId);
  }, [documentId, tabs]);

  /*
   * And the address follows the tabs, so a reload comes back to the same
   * document. Read fresh from the store rather than from this render's value:
   * the effect above may have just moved the selection, and writing the
   * address from a stale reading would move it straight back.
   */
  useEffect(() => {
    const current = useTabsStore.getState().activeId;
    if (!current || current === documentId) return;

    replaceRoute({ name: 'workspace', param: current });
  }, [activeTabId, documentId]);

  /* Stable, or the editor's reporting effect would run on every render. */
  const onSaveStateChange = useCallback((next: SaveState) => setSaveState(next), []);

  const registerFlush = useCallback(
    (flush: (() => void) | null) => {
      if (activeId) onRegisterFlush(activeId, flush);
    },
    [activeId, onRegisterFlush],
  );

  const characters = useMemo(
    () => (activeDocument ? plainTextFromContent(activeDocument.content).length : 0),
    [activeDocument],
  );

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/*
         * The tab strip. It draws nothing while a single document is open — one
         * tab is a label, not a choice — but the row stays, because the control
         * that opens the panel beside the document belongs at this height
         * whether or not there is more than one document to choose between.
         */}
        <div className="noto-print-hidden border-default bg-surface-secondary flex min-h-11 shrink-0 items-stretch border-b">
          <TabBar
            tabs={tabs.tabs}
            onSelect={tabs.open}
            onClose={tabs.close}
            className="min-w-0 flex-1 px-2 pt-1"
          />

          <div className="ml-auto flex shrink-0 items-center gap-1 px-2">
            <IconButton
              label={panelOpen ? 'Hide document details' : 'Show document details'}
              icon={<PanelRightIcon className="h-5 w-5" />}
              isActive={panelOpen}
              disabled={!activeDocument}
              onClick={() => setPanelOpen((open) => !open)}
              size="sm"
              className="hidden lg:inline-flex"
            />
          </div>
        </div>

        {/*
         * Keyed by the open document so that switching tabs restores where the
         * reader was, rather than dropping them back at the title.
         */}
        <EditorScrollArea scrollKey={activeId}>
          {activeDocument ? (
            <DocumentEditor
              key={activeDocument.id}
              document={activeDocument}
              onDirtyChange={tabs.setDirty}
              onRegisterFlush={registerFlush}
              onSaveStateChange={onSaveStateChange}
            />
          ) : activeDocument === null ? (
            <EmptyState
              title="Nothing open"
              description="Select a document, or create a new one to start writing."
              illustration={<WritingIllustration />}
              action={
                <Button
                  variant="primary"
                  onClick={() => void actions.newDocument()}
                  leading={<PlusIcon className="h-5 w-5" />}
                >
                  New document
                </Button>
              }
              className="h-full"
            />
          ) : null}
        </EditorScrollArea>

        {activeDocument ? (
          <EditorStatusBar
            words={activeDocument.wordCount}
            characters={characters}
            saveState={saveState}
            zoom={zoom}
            onHelp={onShortcuts}
          />
        ) : null}
      </main>

      {panelOpen && activeDocument ? (
        <ContextPanel
          document={activeDocument}
          tab={panelTab}
          onTab={setPanelTab}
          onClose={() => setPanelOpen(false)}
          location={workspace?.name ?? 'This workspace'}
        />
      ) : null}
    </>
  );
}
