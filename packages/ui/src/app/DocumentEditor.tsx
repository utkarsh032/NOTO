import { useSettingsStore } from '@noto/core';
import { NotoEditor } from '@noto/editor/react';
import type { DocumentContent, NotoDocument, UpdateDocumentInput } from '@noto/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNotoData } from './data-context';

export interface DocumentEditorProps {
  document: NotoDocument;
}

type SaveState = 'saved' | 'saving';

/**
 * The editing surface for one document.
 *
 * Writes are debounced by the user's autosave delay. The caller keys this
 * component by document id, so switching documents remounts it — which is what
 * lets the title live in plain state and Tiptap rebuild instead of trying to
 * reconcile two unrelated documents.
 */
export function DocumentEditor({ document }: DocumentEditorProps) {
  const { updateDocument } = useNotoData();
  const autoSaveDelayMs = useSettingsStore((state) => state.settings.editor.autoSaveDelayMs);

  const [title, setTitle] = useState(document.title);
  const [saveState, setSaveState] = useState<SaveState>('saved');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpdateDocumentInput>({});

  const scheduleSave = useCallback(
    (patch: UpdateDocumentInput) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setSaveState('saving');

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const queued = pendingRef.current;
        pendingRef.current = {};

        void updateDocument(document.id, queued).then(() => {
          setSaveState('saved');
        });
      }, autoSaveDelayMs);
    },
    [autoSaveDelayMs, document.id, updateDocument],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

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
          {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      <p className="text-subtle mb-6 text-xs">
        {document.wordCount} {document.wordCount === 1 ? 'word' : 'words'}
      </p>

      <NotoEditor
        content={document.content}
        onChange={onContentChange}
        autofocus
        className="noto-prose flex-1"
      />
    </div>
  );
}
