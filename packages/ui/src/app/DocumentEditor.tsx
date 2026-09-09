import { clampZoom, useSettingsStore } from '@noto/core';
import { setShowInvisibles, toEditorContent } from '@noto/editor';
import { NotoEditorContent, useNotoEditor } from '@noto/editor/react';
import type { DocumentContent, NotoDocument, UpdateDocumentInput } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { AlertIcon } from '../components/icons';
import { showToast } from '../components/toast-store';
import { cn } from '../utils/cn';
import { EditorToolbar } from './EditorToolbar';
import { FindReplaceBar } from './FindReplaceBar';
import { subscribeToAppCommands } from './app-commands';
import { useNotoData } from './data-context';
import { sheetStyle, usePageLayout, usePrintPageRule } from './editor/page-layout';
import { saveDocumentToFile } from './local-file';
import { printDocument } from './print';
import { type RecoverySnapshot, clearSnapshot, readSnapshot, writeSnapshot } from './recovery';
import { useCommandShortcuts } from './use-command-shortcuts';
import { useFormattingPrompts } from './use-formatting-prompts';

export interface DocumentEditorProps {
  document: NotoDocument;
  /** Reports whether this document has edits not yet written to storage. */
  onDirtyChange?(documentId: string, dirty: boolean): void;
  /** Hands the shell a way to flush this editor's queue, for Save All. */
  onRegisterFlush?(flush: (() => void) | null): void;
  /**
   * Reports whether this document is saved, saving or has unwritten edits.
   *
   * The status bar sits outside the editor's scroller — below the document
   * rather than inside it — so the state has to travel out to the pane that
   * draws it. There is exactly one indicator, and this is what feeds it.
   */
  onSaveStateChange?(state: SaveState): void;
}

export type SaveState = 'saved' | 'unsaved' | 'saving';

/**
 * The editing surface for one document.
 *
 * Writes are debounced by the user's autosave delay, but never dropped: the
 * queue is flushed when the component unmounts, when the window is hidden and
 * when the user saves explicitly. The caller keys this component by document
 * id, so switching documents remounts it — which is what lets the title live in
 * plain state and Tiptap rebuild instead of trying to reconcile two unrelated
 * documents.
 */
export function DocumentEditor({
  document: activeDocument,
  onDirtyChange,
  onRegisterFlush,
  onSaveStateChange,
}: DocumentEditorProps) {
  const { updateDocument } = useNotoData();
  const { autoSaveDelayMs, showInvisibles, wordWrap, zoom } = useSettingsStore(
    (state) => state.settings.editor,
  );

  const [title, setTitle] = useState(activeDocument.title);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpdateDocumentInput>({});
  const mountedRef = useRef(true);

  const documentId = activeDocument.id;

  /**
   * Writes whatever is queued, right now.
   *
   * Safe to call after unmount — that is the point of it — so it guards every
   * state update rather than assuming the component is still on screen.
   */
  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const queued = pendingRef.current;
    if (Object.keys(queued).length === 0) return Promise.resolve();

    pendingRef.current = {};
    if (mountedRef.current) setSaveState('saving');

    // Returned so unmount can wait for the write before the tab stops saying
    // it has unsaved work.
    return updateDocument(documentId, queued).then(() => {
      // Nothing left for a recovery snapshot to rescue once the write lands.
      if (Object.keys(pendingRef.current).length === 0) clearSnapshot(documentId);
      if (!mountedRef.current) return;

      // A keystroke landing mid-write queues more work. Reporting "Saved" here
      // would describe a document that is already out of date again.
      if (Object.keys(pendingRef.current).length === 0) setSaveState('saved');
    });
  }, [documentId, updateDocument]);

  const scheduleSave = useCallback(
    (patch: UpdateDocumentInput) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setSaveState('unsaved');

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, autoSaveDelayMs);
    },
    [autoSaveDelayMs, flush],
  );

  /* Save All reaches this editor's queue through here. */
  useEffect(() => {
    onRegisterFlush?.(() => void flush());
    return () => onRegisterFlush?.(null);
  }, [onRegisterFlush, flush]);

  /* The tab shows a dot for as long as there is unwritten work. */
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    onDirtyChange?.(documentId, saveState !== 'saved');
    onSaveStateChange?.(saveState);
  }, [onDirtyChange, onSaveStateChange, documentId, saveState]);

  /*
   * Flushing on unmount is what makes switching documents inside the autosave
   * window safe: without it the pending timer is cleared and the user's last
   * few keystrokes are lost with it.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Switching tabs unmounts this editor, so nothing here can report the
      // write finishing — the tab would keep its dot forever. Reporting from
      // the resolved flush is what clears it.
      void flush().then(() => onDirtyChangeRef.current?.(documentId, false));
    };
  }, [flush, documentId]);

  /*
   * Closing a tab or switching away is the other way edits escape. `beforeunload`
   * cannot await an IndexedDB write, but `visibilitychange` fires early enough
   * for one to land.
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') void flush();
    };

    window.document.addEventListener('visibilitychange', onVisibilityChange);
    return () => window.document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [flush]);

  /* ---------------------------------------------------------------------- */
  /* Recovery                                                               */
  /* ---------------------------------------------------------------------- */

  /*
   * What was in the editor when the process last stopped, if that is newer than
   * what reached storage. Read once, on mount, before anything is typed.
   */
  const [recovered, setRecovered] = useState<RecoverySnapshot | null>(() =>
    readSnapshot(activeDocument.id, activeDocument.updatedAt),
  );

  const contentRef = useRef<DocumentContent>(activeDocument.content);
  const titleRef = useRef(activeDocument.title);

  /** Records the live state, so a crash inside the debounce window survives. */
  const snapshot = useCallback(() => {
    writeSnapshot({
      documentId,
      title: titleRef.current,
      content: contentRef.current,
      savedAt: Date.now(),
    });
  }, [documentId]);

  /*
   * The title lives in local state so typing does not wait for a write. That
   * makes it deaf to a rename from anywhere else — the sidebar, most obviously
   * — unless the stored title is watched for changes that did not come from
   * here. A queued title of our own wins, so adopting an external one can never
   * overwrite what is being typed.
   */
  const storedTitleRef = useRef(activeDocument.title);
  useEffect(() => {
    if (activeDocument.title === storedTitleRef.current) return;
    storedTitleRef.current = activeDocument.title;

    if (pendingRef.current.title !== undefined) return;
    setTitle(activeDocument.title);
  }, [activeDocument.title]);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      titleRef.current = value;
      snapshot();
      scheduleSave({ title: value });
    },
    [scheduleSave, snapshot],
  );

  const onContentChange = useCallback(
    (content: DocumentContent) => {
      contentRef.current = content;
      snapshot();
      scheduleSave({ content });
    },
    [scheduleSave, snapshot],
  );

  /*
   * Link, image and table need a URL or a size before they can run. The prompt
   * state is held here so that the toolbar buttons and the accelerators bound
   * inside the editor open the same one.
   */
  const prompts = useFormattingPrompts();

  const editor = useNotoEditor({
    content: activeDocument.content,
    onChange: onContentChange,
    onInteractiveCommand: prompts.handleCommand,
    autofocus: true,
  });

  /*
   * Show Characters is a setting, not document state, so it is pushed into the
   * editor rather than passed at creation: switching it must not rebuild the
   * editor and lose the caret.
   */
  useEffect(() => {
    setShowInvisibles(editor, showInvisibles);
  }, [editor, showInvisibles]);

  /*
   * Printing writes first. The page that comes out of the printer is rendered
   * from the DOM, so it already shows the latest keystroke — but a document
   * that has just been printed and then lost to a crash would be the worst of
   * both, and flushing costs nothing next to opening a print dialog.
   */
  const print = useCallback(async () => {
    await flush();
    await printDocument();
  }, [flush]);

  const restore = useCallback(() => {
    if (!recovered || !editor) return;

    // The same cast the editor uses at every other content boundary.
    editor.commands.setContent(toEditorContent(recovered.content));
    setTitle(recovered.title);
    titleRef.current = recovered.title;
    contentRef.current = recovered.content;
    scheduleSave({ title: recovered.title, content: recovered.content });

    setRecovered(null);
  }, [recovered, editor, scheduleSave]);

  const discardRecovery = useCallback(() => {
    clearSnapshot(documentId);
    setRecovered(null);
  }, [documentId]);

  /* ---------------------------------------------------------------------- */
  /* Find                                                                   */
  /* ---------------------------------------------------------------------- */

  const [find, setFind] = useState({ open: false, replace: false });

  const closeFind = useCallback(() => {
    setFind({ open: false, replace: false });
    editor?.commands.focus();
  }, [editor]);

  /*
   * Save, the way Notepad means it: the document goes to a file on disk. One
   * that already has a file is written straight back to it; one that has none
   * is asked where, once. Save As always asks.
   *
   * The workspace copy is flushed as well, but started rather than awaited. A
   * file dialog will only open while the browser still counts the key press as
   * in hand, and waiting on a database write spends that — so the flush goes
   * first and the dialog is the first thing waited for. Autosave was going to
   * write the workspace copy anyway; this only brings it forward.
   *
   * A dismissed dialog says nothing, because it was a decision. A save that
   * failed says so, because somebody who pressed Save and heard nothing is
   * somebody who believes their work is on disk.
   */
  const saveToFile = useCallback(
    async (chooseLocation: boolean) => {
      void flush();

      try {
        const saved = await saveDocumentToFile(
          documentId,
          { title: titleRef.current, content: contentRef.current },
          { chooseLocation },
        );

        if (!saved) return;

        showToast(saved.linked ? `Saved to ${saved.file.label}` : `Saved ${saved.file.name}`, {
          tone: 'success',
        });
      } catch (error) {
        showToast(
          error instanceof Error && error.message ? error.message : 'Noto could not save the file.',
          { tone: 'error' },
        );
      }
    },
    [documentId, flush],
  );

  /*
   * Save is bound here because this is where the unsaved draft lives, and find
   * because this is what holds the editor. Formatting and undo are deliberately
   * absent: the editor owns those through ProseMirror's keymap, so a shortcut
   * fires once rather than being handled twice and cancelling itself out.
   */
  const shortcutHandlers = useMemo(
    () => ({
      'document.save': () => void saveToFile(false),
      'document.saveAs': () => void saveToFile(true),
      'document.print': () => void print(),
      'edit.find': () => setFind({ open: true, replace: false }),
      'edit.replace': () => setFind({ open: true, replace: true }),
    }),
    [saveToFile, print],
  );

  useCommandShortcuts(shortcutHandlers, {
    hasActiveDocument: true,
    hasSelection: false,
    isEditable: true,
  });

  /*
   * The same handlers, reached without a key. The command palette and any menu
   * run commands by id through the shell, and the shell forwards the ones it
   * has no handler of its own for — these belong to whichever editor is in
   * front, and this is the editor in front.
   */
  useEffect(
    () =>
      subscribeToAppCommands((commandId) => {
        shortcutHandlers[commandId as keyof typeof shortcutHandlers]?.();
      }),
    [shortcutHandlers],
  );

  /*
   * One card: the toolbar at its head, the page under it, the same white
   * surface throughout. The document is the object on the screen, and a
   * formatting bar floating on the background above a second, narrower card
   * reads as two objects — chrome and page — rather than one thing being
   * written in.
   *
   * What that card holds is the user's choice. Simple is the default and the
   * one Noto opens with: the text starts at the left edge of the card and runs
   * the width of the window, because a note is not a publication and half a
   * window of empty margin is half a window wasted. Page is the other choice,
   * asked for: a sheet of a stated size with stated margins, centred on the
   * surface behind it, so what is on the screen is what comes out of the
   * printer.
   */
  const layout = usePageLayout();
  usePrintPageRule(layout);
  const onPaper = layout.mode === 'page';

  return (
    <div className="flex min-h-full flex-col px-4 pb-4 sm:px-6">
      {/*
       * Sticky, so the controls are still there three pages into a document.
       * The strip above it is painted too, or the page would show through the
       * gap between the card's top edge and the window's. None of it belongs on
       * paper, hence `noto-print-hidden`.
       */}
      <div className="noto-print-hidden bg-background sticky top-0 z-10 pt-4">
        <div className="border-default bg-surface rounded-t-xl border border-b-0">
          <EditorToolbar
            editor={editor}
            prompts={prompts}
            onFind={() => setFind({ open: true, replace: false })}
            onPrint={() => void print()}
            className="border-default border-b px-2"
          />

          {find.open ? (
            <FindReplaceBar
              editor={editor}
              showReplace={find.replace}
              onToggleReplace={(replace) => setFind({ open: true, replace })}
              onClose={closeFind}
            />
          ) : null}
        </div>
      </div>

      {recovered ? (
        <RecoveryNotice snapshot={recovered} onRestore={restore} onDiscard={discardRecovery} />
      ) : null}

      {/* `noto-print-document` is what the print rules strip the card back to
          a page with: no border, no shadow, no measure of its own. */}
      <article
        className={cn(
          'noto-print-document noto-print-sheet border-default flex-1 rounded-b-xl border border-t-0',
          onPaper
            ? /* A sheet on a desk: the page is the white object, and the card
                 behind it steps back to being the surface it lies on. */
              'noto-page-desk px-4 py-6 sm:px-8 sm:py-8'
            : 'bg-surface px-6 py-8 sm:px-10 sm:py-10',
        )}
      >
        <div
          className={cn(
            'w-full',
            onPaper &&
              'noto-page border-default bg-surface mx-auto border shadow-[var(--noto-shadow-md)]',
          )}
          style={onPaper ? sheetStyle(layout) : undefined}
        >
          <div className="mb-6">
            {/*
             * An input carries an intrinsic minimum width, so on a narrow
             * window it refuses to shrink and runs under whatever sits beside
             * it. `min-w-0` is what lets the flex row hold.
             */}
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Untitled"
              aria-label="Document title"
              className="text-primary placeholder:text-disabled text-h1 w-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </div>

          {/*
           * Zoom scales the type rather than transforming the element: a
           * transform blurs text and leaves the caret and the selection
           * measuring an unscaled box. Word wrap is a class the prose styles
           * read, so it reaches code blocks and long unbroken strings — the
           * only places a document can outgrow its measure.
           */}
          <NotoEditorContent
            editor={editor}
            className={cn('noto-prose', !wordWrap && 'noto-prose-nowrap')}
            style={{ fontSize: `${clampZoom(zoom)}em` }}
            id="noto-document-body"
          />
        </div>
      </article>
    </div>
  );
}

interface RecoveryNoticeProps {
  snapshot: RecoverySnapshot;
  onRestore(): void;
  onDiscard(): void;
}

/**
 * Offers back work that never reached storage.
 *
 * Phrased as a choice rather than applied automatically: the snapshot is newer,
 * but newer is not the same as wanted, and silently replacing what someone sees
 * with something they did not ask for is the one outcome worse than losing the
 * tail of a sentence.
 */
function RecoveryNotice({ snapshot, onRestore, onDiscard }: RecoveryNoticeProps) {
  const when = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        snapshot.savedAt,
      );
    } catch {
      return null;
    }
  }, [snapshot.savedAt]);

  return (
    <div
      role="status"
      className="noto-print-hidden border-warning/40 bg-warning/10 mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 sm:mx-8"
    >
      <AlertIcon className="text-warning h-5 w-5 shrink-0" />
      <p className="text-primary text-body-sm min-w-0 flex-1">
        Noto kept changes to this document that were never saved
        {when ? `, from ${when}` : ''}.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="primary" onClick={onRestore}>
          Restore them
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}
