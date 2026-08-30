import type { MemoryItem } from '@noto/types';
import { useMemo, useRef, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { KeyHint } from '../../components/KeyHint';
import { VirtualList } from '../../components/VirtualList';
import { showToast } from '../../components/toast-store';
import { SearchIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';
import { MEMORY_KINDS } from '../memory/memory-kinds';
import { useMemory } from '../memory/use-memory';
import { useDebouncedValue } from '../use-debounced-value';

export interface QuickPasteProps {
  open: boolean;
  onClose(): void;
}

/** Every row is this tall, which is what lets the list be windowed. */
const ROW_HEIGHT = 60;

/**
 * Quick Paste.
 *
 * Everything Noto has captured, one keystroke from the clipboard. It is a
 * command surface rather than a screen: type, arrow, Enter, and you are back in
 * whatever application you were in.
 *
 * The list is windowed. Memory is specified to hold tens of thousands of items,
 * and this is the one surface where all of them are in scope at once — so the
 * number of rows in the document stays constant no matter how much is stored.
 */
export function QuickPaste({ open, onClose }: QuickPasteProps) {
  /* Not mounted while closed, so it always opens empty without an effect to
     empty it. */
  if (!open) return null;
  return <QuickPasteSurface onClose={onClose} />;
}

function QuickPasteSurface({ onClose }: { onClose(): void }) {
  const memory = useMemory();
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useDebouncedValue(text, 120);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return memory.items;

    return memory.items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.content.toLowerCase().includes(needle) ||
        (item.source ?? '').toLowerCase().includes(needle),
    );
  }, [memory.items, query]);

  /*
   * Clamped where it is read rather than corrected in an effect: a query that
   * shortens the list must not leave the highlight past the end, and fixing
   * that after the fact would render the wrong row first.
   */
  const selected = results.length === 0 ? 0 : Math.min(cursor, results.length - 1);

  const paste = (item: MemoryItem | undefined) => {
    if (!item) return;

    onClose();
    void navigator.clipboard
      ?.writeText(item.content)
      .then(() => showToast('Copied — paste it wherever you were', { tone: 'success' }))
      .catch(() => showToast('Noto could not reach the clipboard.', { tone: 'error' }));
  };

  return (
    <Dialog open onClose={onClose} title="Quick Paste" size="md" bare>
      <div
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor(Math.min(selected + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor(Math.max(selected - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            paste(results[selected]);
          }
        }}
      >
        <div className="border-default flex items-center gap-3 border-b px-4">
          <SearchIcon className="text-tertiary h-5 w-5 shrink-0" />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCursor(0);
            }}
            placeholder="Search memory to paste…"
            aria-label="Search memory to paste"
            className="text-primary placeholder:text-disabled text-body-lg h-14 w-full bg-transparent outline-none"
          />
          <KeyHint keys="Esc" />
        </div>

        <div className="flex h-[min(420px,50vh)] flex-col">
          {results.length === 0 ? (
            <p className="text-tertiary text-body-sm px-4 py-10 text-center">
              Nothing in Memory matches “{text}”.
            </p>
          ) : (
            <VirtualList
              items={results}
              itemHeight={ROW_HEIGHT}
              label="Memory items"
              className="px-2 py-2"
              keyOf={(item) => item.id}
              renderItem={(item, index) => {
                const kind = MEMORY_KINDS[item.kind];

                return (
                  <button
                    type="button"
                    onMouseMove={() => setCursor(index)}
                    onClick={() => paste(item)}
                    className={cn(
                      'flex h-full w-full items-center gap-3 rounded-lg px-3 text-left transition-colors',
                      index === selected ? 'bg-brand-soft' : 'hover:bg-surface-secondary',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                        kind.glyphClassName,
                      )}
                    >
                      {kind.icon('h-4 w-4')}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-body-sm block truncate font-medium',
                          index === selected ? 'text-brand-strong' : 'text-primary',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="text-tertiary text-caption block truncate">
                        {item.content}
                      </span>
                    </span>

                    <span className="text-tertiary text-caption shrink-0">
                      {relativeTime(item.updatedAt)}
                    </span>
                  </button>
                );
              }}
            />
          )}
        </div>

        <div className="border-default text-tertiary text-caption flex items-center gap-3 border-t px-4 py-2">
          <span className="flex items-center gap-1.5">
            <KeyHint keys="↑↓" /> move
          </span>
          <span className="flex items-center gap-1.5">
            <KeyHint keys="↵" /> copy
          </span>
          <span className="ml-auto tabular-nums">{results.length.toLocaleString()} items</span>
        </div>
      </div>
    </Dialog>
  );
}
