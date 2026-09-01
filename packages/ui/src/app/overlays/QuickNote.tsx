import { contentFromPlainText } from '@noto/core';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { StatusIndicator } from '../../components/StatusIndicator';
import { showToast } from '../../components/toast-store';
import { CloseIcon, DocumentIcon, ExternalLinkIcon, QuickNoteIcon } from '../../components/icons';
import { quickNoteTitle, readQuickNoteDraft, writeQuickNoteDraft } from '../quick-note-draft';
import { navigate } from '../router';
import { useNotoActions } from '../use-noto-actions';

export interface QuickNoteProps {
  open: boolean;
  onClose(): void;
}

/**
 * Quick Note.
 *
 * A window that floats over whatever you were doing, takes a thought, and gets
 * out of the way. It is deliberately not a screen: the point is that it costs
 * nothing to open, so it must cost nothing to abandon.
 *
 * It does now have a screen behind it — `#/quick-note`, reachable from the
 * header of this window — but that is where notes are read and turned into
 * documents, not where they are caught. The draft is the same string in both
 * places, so a thought started here is already on that page when you get there.
 *
 * The draft is written to local storage on every keystroke. Closing without
 * saving is a normal thing to do — the note is still there next time — and only
 * Save turns it into a document the workspace lists.
 *
 * Closed, it is not mounted at all, which is what makes the draft simply the
 * field's initial state: no effect has to notice the window opening and put
 * yesterday's note back into it.
 */
export function QuickNote({ open, onClose }: QuickNoteProps) {
  if (!open) return null;
  return <QuickNoteWindow onClose={onClose} />;
}

function QuickNoteWindow({ onClose }: { onClose(): void }) {
  const actions = useNotoActions();
  const [text, setText] = useState(readQuickNoteDraft);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /* After the panel has been painted, or the caret lands nowhere. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => areaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    writeQuickNoteDraft(text);
  }, [text]);

  const save = () => {
    const value = text.trim();
    if (value === '') return;

    void actions
      .importDocument({
        title: quickNoteTitle(value),
        content: contentFromPlainText(value),
      })
      .then(() => {
        writeQuickNoteDraft('');
        showToast('Saved as a document', { tone: 'success' });
        onClose();
      });
  };

  return (
    <div
      role="dialog"
      aria-label="Quick Note"
      /*
       * Bottom-right, over the application rather than in front of it: there is
       * no scrim, because the point of a quick note is that whatever you were
       * reading is still visible while you write it down.
       */
      className="noto-print-hidden border-default bg-surface fixed right-4 bottom-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col rounded-2xl border shadow-[var(--noto-shadow-lg)] sm:right-6 sm:bottom-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
        /* The one accelerator a note window needs. */
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          save();
        }
      }}
    >
      <header className="border-default flex items-center gap-2 border-b px-4 py-2.5">
        <QuickNoteIcon className="text-brand-hover h-5 w-5" />
        <h2 className="text-primary text-body-sm flex-1 font-semibold">Quick Note</h2>
        <IconButton
          label="Open the Quick Notes page"
          size="sm"
          icon={<ExternalLinkIcon className="h-4 w-4" />}
          onClick={() => {
            onClose();
            navigate('quick-note');
          }}
        />
        <IconButton
          label="Close Quick Note"
          size="sm"
          icon={<CloseIcon className="h-4 w-4" />}
          onClick={onClose}
        />
      </header>

      <textarea
        ref={areaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write it down before it goes…"
        aria-label="Quick note"
        rows={9}
        className="text-primary placeholder:text-disabled text-body min-h-44 w-full resize-none bg-transparent px-4 py-3 leading-relaxed outline-none"
      />

      <footer className="border-default flex items-center justify-between gap-3 border-t px-4 py-2.5">
        <StatusIndicator status={text === '' ? 'pending' : 'saved'} label="Saved locally" />

        <Button
          size="sm"
          variant="primary"
          onClick={save}
          disabled={text.trim() === ''}
          leading={<DocumentIcon className="h-4 w-4" />}
        >
          Save
        </Button>
      </footer>
    </div>
  );
}
