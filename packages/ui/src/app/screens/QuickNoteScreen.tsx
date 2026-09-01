import { contentFromPlainText, formatShortcut } from '@noto/core';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { KeyHint } from '../../components/KeyHint';
import { SearchInput } from '../../components/SearchInput';
import { showToast } from '../../components/toast-store';
import {
  ClipboardIcon,
  DocumentIcon,
  PanelRightIcon,
  QuickNoteIcon,
  TrashIcon,
} from '../../components/icons';
import { QuickNoteIllustration } from '../../components/illustrations';
import { PageContainer } from '../PageContainer';
import { MemoryCard } from '../memory/MemoryCard';
import { useMemory } from '../memory/use-memory';
import {
  quickNoteTitle,
  readQuickNoteDraft,
  subscribeToQuickNoteDraft,
  writeQuickNoteDraft,
} from '../quick-note-draft';
import { navigate } from '../router';
import { detectShortcutPlatform } from '../use-command-shortcuts';
import { useNotoActions } from '../use-noto-actions';

export interface QuickNoteScreenProps {
  /** Opens the floating capture window, for a note taken over something else. */
  onQuickNote(): void;
  /** Shows the dock — the handle that stays on the display edge. */
  onShowDock(): void;
}

/**
 * The Quick Notes screen.
 *
 * Quick Note has always been a window you summon over your work; what it never
 * had was somewhere the notes went. Everything captured went into Memory and
 * was read there, among clipboard entries and screenshots, which is the right
 * place for it to end up and the wrong place to go looking for the thing you
 * jotted down ninety seconds ago.
 *
 * So: the composer at the top, writing the same draft the floating window and
 * the desktop dock write, and everything captured before it underneath. The
 * composer is the page's subject, which is why it is the widest thing on it and
 * why the caret is the first thing here that can take a keystroke.
 */
export function QuickNoteScreen({ onQuickNote, onShowDock }: QuickNoteScreenProps) {
  const actions = useNotoActions();
  const memory = useMemory('note');
  const platform = useMemo(() => detectShortcutPlatform(), []);

  /*
   * The draft is external state — the floating window and the dock write it
   * too — so it is subscribed to rather than copied into `useState`. Typing
   * here and typing there are then the same edit rather than two that overwrite
   * each other on the next render.
   */
  const draft = useSyncExternalStore(subscribeToQuickNoteDraft, readQuickNoteDraft, () => '');

  const [search, setSearch] = useState('');

  const notes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return memory.results;

    return memory.results.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) || item.content.toLowerCase().includes(needle),
    );
  }, [memory.results, search]);

  const save = () => {
    const value = draft.trim();
    if (value === '') return;

    void actions
      .importDocument({ title: quickNoteTitle(value), content: contentFromPlainText(value) })
      .then(() => {
        writeQuickNoteDraft('');
        showToast('Saved as a document', { tone: 'success' });
      });
  };

  return (
    <PageContainer
      title="Quick Notes"
      subtitle="Somewhere to put a thought before it goes. Nothing here is a document until you say so."
      asideLabel="Ways to capture"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onQuickNote}
            leading={<QuickNoteIcon className="h-4 w-4" />}
          >
            Floating window
          </Button>
          <Button
            variant="secondary"
            onClick={onShowDock}
            leading={<PanelRightIcon className="h-4 w-4" />}
          >
            Show the dock
          </Button>
        </>
      }
      aside={
        <div className="flex flex-col gap-4">
          <section className="border-default bg-surface rounded-xl border p-4">
            <QuickNoteIllustration className="h-10 w-10" />
            <h2 className="text-primary text-body-sm mt-2 font-semibold">Three ways in</h2>
            <ul className="text-secondary text-caption mt-2 flex flex-col gap-3">
              <li>
                <span className="text-primary block font-medium">This page</span>
                Write, then save it as a document when it turns into one.
              </li>
              <li>
                <span className="text-primary block font-medium">The floating window</span>
                Over whatever you are reading, without leaving it.
                <KeyHint keys={formatShortcut('CmdOrCtrl+Alt+N', platform)} className="mt-1.5" />
              </li>
              <li>
                <span className="text-primary block font-medium">The dock</span>A handle on the edge
                of the display that outlives the Noto window — drag it to whichever side you want it
                on.
              </li>
            </ul>
          </section>

          <section className="border-default bg-surface rounded-xl border p-4">
            <h2 className="text-primary text-body-sm font-semibold">The draft is one draft</h2>
            <p className="text-tertiary text-caption mt-1.5">
              What you type here is what the floating window and the dock have open. Start a note in
              one, finish it in another.
            </p>
          </section>
        </div>
      }
    >
      <section aria-labelledby="noto-compose-heading">
        <h2 id="noto-compose-heading" className="sr-only">
          Write a quick note
        </h2>

        <div className="border-default bg-surface focus-within:border-brand-subtle rounded-2xl border shadow-sm transition-colors">
          <textarea
            value={draft}
            onChange={(event) => writeQuickNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                save();
              }
            }}
            /* Autofocus is right exactly once — on the screen whose entire
               subject is an empty field waiting for a thought. */
            autoFocus
            rows={8}
            aria-label="Quick note"
            placeholder="Write it down before it goes…"
            className="text-primary placeholder:text-disabled text-body-lg min-h-48 w-full resize-none bg-transparent px-5 py-4 leading-relaxed outline-none"
          />

          <footer className="border-default flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-tertiary text-caption">
              {draft.trim() === ''
                ? 'Saved on this device as you type.'
                : `${draft.trim().split(/\s+/).length} words · saved on this device`}
            </p>

            <div className="flex items-center gap-2">
              <KeyHint keys={formatShortcut('CmdOrCtrl+Enter', platform)} />
              <Button
                variant="secondary"
                size="sm"
                disabled={draft === ''}
                onClick={() => writeQuickNoteDraft('')}
                leading={<TrashIcon className="h-4 w-4" />}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={draft.trim() === ''}
                onClick={save}
                leading={<DocumentIcon className="h-4 w-4" />}
              >
                Save as document
              </Button>
            </div>
          </footer>
        </div>
      </section>

      <section aria-labelledby="noto-captured-heading" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="noto-captured-heading" className="text-primary text-h2 flex items-center gap-2.5">
            Captured
            <Badge tone="brand">{memory.countsByKind.note}</Badge>
          </h2>

          <SearchInput
            value={search}
            onValueChange={setSearch}
            label="Search quick notes"
            placeholder="Search quick notes…"
            inputSize="sm"
            className="w-full sm:w-72"
          />
        </div>

        {notes.length === 0 ? (
          <EmptyState
            className="mt-6"
            illustration={<QuickNoteIllustration className="h-12 w-12" />}
            title={search === '' ? 'Nothing captured yet' : 'No quick notes match that'}
            description={
              search === ''
                ? 'Notes you jot down here, in the floating window or on the dock will collect in this list.'
                : 'Try a shorter search, or clear it to see everything captured.'
            }
            action={
              search === '' ? null : (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              )
            }
          />
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {notes.map((item) => (
              <li key={item.id}>
                <MemoryCard
                  item={item}
                  onCopy={() => {
                    void navigator.clipboard
                      ?.writeText(item.content)
                      .then(() => showToast('Copied to clipboard', { tone: 'success' }));
                  }}
                  onTogglePin={() => memory.togglePin(item)}
                  onOpenInDocument={() => {
                    void actions
                      .importDocument({
                        title: item.title,
                        content: contentFromPlainText(item.content),
                      })
                      .then(() => {
                        showToast('Saved as a document', { tone: 'success' });
                        navigate('documents');
                      });
                  }}
                  onDelete={() => memory.remove(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The one other place a captured thing can come from, said once rather
          than repeated on every empty card. */}
      <p className="text-tertiary text-caption mt-8 flex items-center gap-2">
        <ClipboardIcon className="h-4 w-4 shrink-0" />
        Clipboard entries and screenshots live in Noto Memory alongside these.
      </p>
    </PageContainer>
  );
}
