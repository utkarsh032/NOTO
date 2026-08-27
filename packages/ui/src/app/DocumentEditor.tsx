import { clampZoom, useSettingsStore } from '@noto/core';
import { toEditorContent } from '@noto/editor';
import { NotoEditorContent, useNotoEditor } from '@noto/editor/react';
import type { DocumentContent, NotoDocument, UpdateDocumentInput } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { StatusIndicator, type StatusKind } from '../components/StatusIndicator';
import { AlertIcon } from '../components/icons';
import { cn } from '../utils/cn';
import { EditorToolbar } from './EditorToolbar';
import { FindReplaceBar } from './FindReplaceBar';
import { useNotoData } from './data-context';
import { type RecoverySnapshot, clearSnapshot, readSnapshot, writeSnapshot } from './recovery';
import { useCommandShortcuts } from './use-command-shortcuts';
import { useFormattingPrompts } from './use-formatting-prompts';

export interface DocumentEditorProps {
  document: NotoDocument;
  /** Reports whether this document has edits not yet written to storage. */
  onDirtyChange?(documentId: string, dirty: boolean): void;
  /** Hands the shell a way to flush this editor's queue, for Save All. */
  onRegisterFlush?(flush: (() => void) | null): void;
}

type SaveState = 'saved' | 'unsaved' | 'saving';

/** Noto is local-first, so this says "saved", not "synced". */
const SAVE_STATE: Record<SaveState, { status: StatusKind; label: string }> = {
  saved: { status: 'saved', label: 'Saved' },
  unsaved: { status: 'pending', label: 'Unsaved changes' },
  saving: { status: 'busy', label: 'Saving…' },
};

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
}: DocumentEditorProps) {
  const { updateDocument } = useNotoData();
  const { autoSaveDelayMs, wordWrap, zoom } = useSettingsStore((state) => state.settings.editor);

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
  }, [onDirtyChange, documentId, saveState]);

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
   * Save is bound here because this is where the unsaved draft lives, and find
   * because this is what holds the editor. Formatting and undo are deliberately
   * absent: the editor owns those through ProseMirror's keymap, so a shortcut
   * fires once rather than being handled twice and cancelling itself out.
   */
  const shortcutHandlers = useMemo(
    () => ({
      'document.save': () => void flush(),
      'edit.find': () => setFind({ open: true, replace: false }),
      'edit.replace': () => setFind({ open: true, replace: true }),
    }),
    [flush],
  );

  useCommandShortcuts(shortcutHandlers, {
    hasActiveDocument: true,
    hasSelection: false,
    isEditable: true,
  });

  const save = SAVE_STATE[saveState];

  /*
   * A white canvas on the application's off-white background, at a comfortable
   * measure. The card is what makes the document the object on the screen
   * rather than a region of the window chrome.
   *
   * The toolbar sits outside that measure and spans the pane: twenty controls
   * do not fit across an 800px column without wrapping to a second row, and a
   * toolbar that changes height as the window resizes is not a fixed thing the
   * hand can learn.
   */
  return (
    <div className="flex min-h-full flex-col">
      {/* Sticky, so the controls are still there three pages into a document. */}
      <div className="bg-background sticky top-0 z-10">
        <EditorToolbar
          editor={editor}
          prompts={prompts}
          onFind={() => setFind({ open: true, replace: false })}
          className="border-default border-b px-4 sm:px-6"
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

      {recovered ? (
        <RecoveryNotice snapshot={recovered} onRestore={restore} onDiscard={discardRecovery} />
      ) : null}

      <div className="max-w-editor mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <article className="border-default bg-surface rounded-lg border px-5 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="mb-6">
            <div className="mb-1 flex items-baseline justify-between gap-4">
              {/*
               * An input carries an intrinsic minimum width, so on a narrow
               * window it refuses to shrink and runs under the save state
               * beside it. `min-w-0` is what lets the flex row hold.
               */}
              <input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Untitled"
                aria-label="Document title"
                className="text-primary placeholder:text-disabled text-h1 w-full min-w-0 flex-1 bg-transparent outline-none"
              />
              <StatusIndicator status={save.status} label={save.label} className="shrink-0" />
            </div>

            {/* Metadata is present but quiet: it is about the document, not the
                document itself. */}
            <p className="text-tertiary text-caption">
              {activeDocument.wordCount} {activeDocument.wordCount === 1 ? 'word' : 'words'}
            </p>
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
        </article>
      </div>
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
      className="border-warning/40 bg-warning/10 mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 sm:mx-8"
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
