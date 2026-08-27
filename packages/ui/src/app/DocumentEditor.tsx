import { useSettingsStore } from '@noto/core';
import { NotoEditorContent, useNotoEditor } from '@noto/editor/react';
import type { DocumentContent, NotoDocument, UpdateDocumentInput } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StatusIndicator, type StatusKind } from '../components/StatusIndicator';
import { EditorToolbar } from './EditorToolbar';
import { useNotoData } from './data-context';
import { useCommandShortcuts } from './use-command-shortcuts';
import { useFormattingPrompts } from './use-formatting-prompts';

export interface DocumentEditorProps {
  document: NotoDocument;
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
export function DocumentEditor({ document: activeDocument }: DocumentEditorProps) {
  const { updateDocument } = useNotoData();
  const autoSaveDelayMs = useSettingsStore((state) => state.settings.editor.autoSaveDelayMs);

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
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const queued = pendingRef.current;
    if (Object.keys(queued).length === 0) return;

    pendingRef.current = {};
    if (mountedRef.current) setSaveState('saving');

    void updateDocument(documentId, queued).then(() => {
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

  /*
   * Flushing on unmount is what makes switching documents inside the autosave
   * window safe: without it the pending timer is cleared and the user's last
   * few keystrokes are lost with it.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      flush();
    };
  }, [flush]);

  /*
   * Closing a tab or switching away is the other way edits escape. `beforeunload`
   * cannot await an IndexedDB write, but `visibilitychange` fires early enough
   * for one to land.
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') flush();
    };

    window.document.addEventListener('visibilitychange', onVisibilityChange);
    return () => window.document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [flush]);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      scheduleSave({ title: value });
    },
    [scheduleSave],
  );

  const onContentChange = useCallback(
    (content: DocumentContent) => {
      scheduleSave({ content });
    },
    [scheduleSave],
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

  // Save is bound here rather than in the shell because this is where the
  // unsaved draft lives. Formatting accelerators are not bound at this level at
  // all: the editor owns those through ProseMirror's keymap, so a shortcut
  // fires once rather than being handled twice and cancelling itself out.
  const shortcutHandlers = useMemo(() => ({ 'document.save': flush }), [flush]);

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
      <EditorToolbar
        editor={editor}
        prompts={prompts}
        className="border-default bg-background sticky top-0 z-10 border-b px-4 sm:px-6"
      />

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

          <NotoEditorContent editor={editor} className="noto-prose" id="noto-document-body" />
        </article>
      </div>
    </div>
  );
}
