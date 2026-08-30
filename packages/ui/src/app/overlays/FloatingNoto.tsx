import { useMemo, useState } from 'react';

import { IconButton } from '../../components/IconButton';
import { SearchInput } from '../../components/SearchInput';
import { showToast } from '../../components/toast-store';
import {
  ClipboardIcon,
  CloseIcon,
  DocumentIcon,
  QuickNoteIcon,
  SparklesIcon,
} from '../../components/icons';
import notoIcon from '../../assets/noto-icon.png';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';
import { MEMORY_KINDS } from '../memory/memory-kinds';
import { useMemory } from '../memory/use-memory';
import { useNotoData } from '../data-context';
import { useDebouncedValue } from '../use-debounced-value';
import { useNotoActions } from '../use-noto-actions';

export interface FloatingNotoProps {
  open: boolean;
  onClose(): void;
  onQuickNote(): void;
  onQuickPaste(): void;
  onAskAI(): void;
}

/**
 * The floating Noto window.
 *
 * A pocket-sized Noto for when the application is not what you are looking at:
 * search what you have captured, jot something down, paste something back, and
 * get to the last few documents. Desktop-only, so it is hidden on a phone,
 * where the whole application is already one tap away.
 *
 * Inside the application it renders as a floating panel. On desktop it is meant
 * to be an always-available window of its own; that is a main-process concern,
 * and this is the interface it will put inside it.
 */
export function FloatingNoto({
  open,
  onClose,
  onQuickNote,
  onQuickPaste,
  onAskAI,
}: FloatingNotoProps) {
  const { documents } = useNotoData();
  const memory = useMemory();
  const actions = useNotoActions();

  const [text, setText] = useState('');
  const query = useDebouncedValue(text, 120);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];

    return memory.items
      .filter(
        (item) =>
          item.title.toLowerCase().includes(needle) || item.content.toLowerCase().includes(needle),
      )
      .slice(0, 5);
  }, [memory.items, query]);

  const recent = useMemo(
    () =>
      [...(documents ?? [])]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 4),
    [documents],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Floating Noto"
      className="noto-print-hidden border-default bg-surface fixed top-20 right-6 z-40 hidden w-80 flex-col rounded-2xl border shadow-[var(--noto-shadow-lg)] lg:flex"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="border-default flex items-center gap-2 border-b px-3 py-2.5">
        <img src={notoIcon} alt="" className="h-6 w-6" draggable={false} />
        <h2 className="text-primary text-body-sm flex-1 font-semibold">Noto</h2>
        <IconButton
          label="Close floating Noto"
          size="sm"
          icon={<CloseIcon className="h-4 w-4" />}
          onClick={onClose}
        />
      </header>

      <div className="p-3">
        <SearchInput
          value={text}
          onValueChange={setText}
          label="Search memory"
          placeholder="Search memory…"
          inputSize="sm"
        />

        {results.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-0.5">
            {results.map((item) => {
              const kind = MEMORY_KINDS[item.kind];

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(item.content)
                        .then(() => showToast('Copied to clipboard', { tone: 'success' }));
                    }}
                    className="hover:bg-surface-secondary focus-visible:outline-brand flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2"
                  >
                    <span className={cn('shrink-0 rounded-sm p-1', kind.glyphClassName)}>
                      {kind.icon('h-3.5 w-3.5')}
                    </span>
                    <span className="text-primary text-caption min-w-0 flex-1 truncate">
                      {item.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-2">
          <FloatingAction
            label="Quick Note"
            icon={<QuickNoteIcon className="h-5 w-5" />}
            tone="bg-brand-soft text-brand-hover"
            onSelect={onQuickNote}
          />
          <FloatingAction
            label="Quick Paste"
            icon={<ClipboardIcon className="h-5 w-5" />}
            tone="bg-info/10 text-info"
            onSelect={onQuickPaste}
          />
          <FloatingAction
            label="Ask AI"
            icon={<SparklesIcon className="h-5 w-5" />}
            tone="bg-ai-soft text-ai"
            onSelect={onAskAI}
          />
        </div>

        {recent.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-tertiary text-caption px-1 pb-1 tracking-wide uppercase">Recent</h3>
            <ul className="flex flex-col gap-0.5">
              {recent.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      actions.openDocument(document.id);
                    }}
                    className="hover:bg-surface-secondary focus-visible:outline-brand flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2"
                  >
                    <DocumentIcon className="text-tertiary h-4 w-4 shrink-0" />
                    <span className="text-primary text-caption min-w-0 flex-1 truncate">
                      {document.title || 'Untitled'}
                    </span>
                    <span className="text-tertiary text-caption shrink-0">
                      {relativeTime(document.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

interface FloatingActionProps {
  label: string;
  icon: React.ReactNode;
  tone: string;
  onSelect(): void;
}

function FloatingAction({ label, icon, tone, onSelect }: FloatingActionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="border-default hover:border-strong focus-visible:outline-brand flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors focus-visible:outline-2"
    >
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', tone)}>
        {icon}
      </span>
      <span className="text-secondary text-caption text-center leading-tight">{label}</span>
    </button>
  );
}
