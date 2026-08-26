import { useSettingsStore } from '@noto/core';
import { NotoEditor } from '@noto/editor/react';
import type { DocumentContent, NotoDocument, UpdateDocumentInput } from '@noto/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotoData } from './data-context';
import { useCommandShortcuts } from './use-command-shortcuts';

export interface DocumentEditorProps {
  document: NotoDocument;
}

type SaveState = 'saved' | 'unsaved' | 'saving';

const SAVE_STATE_LABELS: Record<SaveState, string> = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
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

  // Save is bound here rather than in the shell because this is where the
  // unsaved draft lives.
  const shortcutHandlers = useMemo(() => ({ 'document.save': flush }), [flush]);

  useCommandShortcuts(shortcutHandlers, {
    hasActiveDocument: true,
    hasSelection: false,
    isEditable: true,
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-10">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Untitled"
          aria-label="Document title"
          className="text-content placeholder:text-subtle w-full bg-transparent text-3xl font-semibold outline-none"
        />
        <span className="text-subtle shrink-0 text-xs" aria-live="polite">
          {SAVE_STATE_LABELS[saveState]}
        </span>
      </div>

      <p className="text-subtle mb-6 text-xs">
        {activeDocument.wordCount} {activeDocument.wordCount === 1 ? 'word' : 'words'}
      </p>

      <NotoEditor
        content={activeDocument.content}
        onChange={onContentChange}
        autofocus
        className="noto-prose flex-1"
      />
    </div>
  );
}
