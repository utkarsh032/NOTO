import {
  clampZoom,
  plainTextFromContent,
  useSettingsStore,
  useTabsStore,
  useUiStore,
} from '@noto/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PlusIcon } from '../../components/icons';
import { WritingIllustration } from '../../components/illustrations';
import { DocumentEditor, type SaveState } from '../DocumentEditor';
import { EditorScrollArea } from '../EditorScrollArea';
import { ContextPanel, type ContextTab } from '../editor/ContextPanel';
import { EditorStatusBar } from '../editor/EditorStatusBar';
import { useNotoData } from '../data-context';
import { useLocalFile } from '../local-file';
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
 * The workspace: the document, and what is beside it.
 *
 * This is the screen Noto exists for, so the arrangement is deliberately plain
 * — the page, and a line of facts underneath — and everything that is not the
 * document either scrolls away with it or sits quietly at an edge.
 *
 * The tabs are no longer here. They are the window's header now, above every
 * screen rather than only this one, and the two controls that used to sit at
 * the end of the strip went with them; what they act on is the document, but
 * where they belong is the bar that names it. This screen reads whether the
 * context panel is open from the shared UI store, which is the one answer both
 * ends of that arrangement agree on.
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

  const panelOpen = useUiStore((state) => state.contextPanelOpen);
  const [panelTab, setPanelTab] = useState<ContextTab>('outline');
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const activeId = activeDocument?.id ?? null;

  /* The file on disk behind the open document, for the status bar to name. */
  const localFile = useLocalFile(activeId);

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
            file={localFile}
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
          location={workspace?.name ?? 'This workspace'}
        />
      ) : null}
    </>
  );
}
