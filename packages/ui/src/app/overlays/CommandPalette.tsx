import { CORE_COMMANDS, createCommandRegistry, formatShortcut } from '@noto/core';
import type { CommandCategory, CommandContext } from '@noto/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { KeyHint } from '../../components/KeyHint';
import {
  ArrowRightIcon,
  ClipboardIcon,
  DocumentIcon,
  ImageIcon,
  MonitorIcon,
  PencilIcon,
  SearchIcon,
  SettingsIcon,
  TypeIcon,
  type IconProps,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';
import { MEMORY_KINDS } from '../memory/memory-kinds';
import { useMemory } from '../memory/use-memory';
import { useNotoData } from '../data-context';
import { detectShortcutPlatform } from '../use-command-shortcuts';
import { useDebouncedValue } from '../use-debounced-value';
import { useNotoActions } from '../use-noto-actions';

export interface CommandPaletteProps {
  open: boolean;
  onClose(): void;
  /** Runs a command id the shell knows how to handle. */
  onRunCommand(commandId: string): void;
  /** Which commands are available right now. */
  context: CommandContext;
}

interface Entry {
  id: string;
  group: 'Documents' | 'Memory' | 'Commands';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: (props: IconProps) => React.ReactElement;
  run(): void;
}

/** How many of each kind to offer before the list stops being scannable. */
const PER_GROUP = 6;

/**
 * A glyph per command category.
 *
 * One icon for everything would be decoration; these say what kind of thing a
 * row is before the label is read, which is what makes a long list scannable.
 */
const CATEGORY_ICON: Record<CommandCategory, (props: IconProps) => React.ReactElement> = {
  file: DocumentIcon,
  edit: PencilIcon,
  format: TypeIcon,
  insert: ImageIcon,
  view: MonitorIcon,
  navigation: ArrowRightIcon,
  app: SettingsIcon,
};

/**
 * The command palette.
 *
 * Raycast's shape rather than a menu's: one field, one list, everything Noto
 * can do or open reachable from the keyboard alone. Documents and memory come
 * first when there is a query, because most of the time what you want is a
 * thing rather than an action.
 */
export function CommandPalette({ open, ...props }: CommandPaletteProps) {
  /* Not mounted while closed, so it always opens on an empty field without an
     effect to clear the last search out of it. */
  if (!open) return null;
  return <CommandPaletteSurface {...props} />;
}

function CommandPaletteSurface({
  onClose,
  onRunCommand,
  context,
}: Omit<CommandPaletteProps, 'open'>) {
  const { documents } = useNotoData();
  const actions = useNotoActions();
  const memory = useMemory();

  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const query = useDebouncedValue(text, 120);
  const platform = useMemo(() => detectShortcutPlatform(), []);
  const registry = useMemo(() => createCommandRegistry(CORE_COMMANDS), []);

  const entries = useMemo<Entry[]>(() => {
    const needle = query.trim().toLowerCase();

    const documentEntries: Entry[] = (documents ?? [])
      .filter(
        (document) =>
          needle === '' ||
          document.title.toLowerCase().includes(needle) ||
          document.excerpt.toLowerCase().includes(needle),
      )
      .slice(0, PER_GROUP)
      .map((document) => ({
        id: `document-${document.id}`,
        group: 'Documents' as const,
        title: document.title || 'Untitled',
        subtitle: `Edited ${relativeTime(document.updatedAt)}`,
        icon: DocumentIcon,
        run: () => actions.openDocument(document.id),
      }));

    const memoryEntries: Entry[] =
      needle === ''
        ? []
        : memory.items
            .filter(
              (item) =>
                item.title.toLowerCase().includes(needle) ||
                item.content.toLowerCase().includes(needle),
            )
            .slice(0, PER_GROUP)
            .map((item) => ({
              id: `memory-${item.id}`,
              group: 'Memory' as const,
              title: item.title,
              subtitle: `${MEMORY_KINDS[item.kind].label} · ${relativeTime(item.updatedAt)}`,
              icon: item.kind === 'clipboard' ? ClipboardIcon : SearchIcon,
              run: () => {
                void navigator.clipboard?.writeText(item.content);
              },
            }));

    const commandEntries: Entry[] = registry
      .search(query, context)
      .slice(0, needle === '' ? 8 : PER_GROUP)
      .map((command) => ({
        id: `command-${command.id}`,
        group: 'Commands' as const,
        title: command.title,
        shortcut: command.shortcut ? formatShortcut(command.shortcut, platform) : undefined,
        icon: CATEGORY_ICON[command.category],
        run: () => onRunCommand(command.id),
      }));

    return [...documentEntries, ...memoryEntries, ...commandEntries];
  }, [query, documents, memory.items, registry, context, platform, actions, onRunCommand]);

  /*
   * Clamped where it is read rather than corrected afterwards: a query that
   * shortens the list must not leave the highlight past its end, and putting
   * that right in an effect would render one frame with the wrong row lit.
   */
  const selected = entries.length === 0 ? 0 : Math.min(cursor, entries.length - 1);

  /* Keep the highlighted row in view while arrowing through a long list. */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const run = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((selected + 1) % Math.max(1, entries.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((selected - 1 + entries.length) % Math.max(1, entries.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(entries[selected]);
    }
  };

  let lastGroup: Entry['group'] | null = null;

  return (
    <Dialog open onClose={onClose} title="Command palette" size="md" bare>
      <div onKeyDown={onKeyDown}>
        <div className="border-default flex items-center gap-3 border-b px-4">
          <SearchIcon className="text-tertiary h-5 w-5 shrink-0" />
          <input
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCursor(0);
            }}
            placeholder="Search documents, memory and commands…"
            aria-label="Search documents, memory and commands"
            className="text-primary placeholder:text-disabled text-body-lg h-14 w-full bg-transparent outline-none"
          />
          <KeyHint keys="Esc" />
        </div>

        <div ref={listRef} className="noto-scroll-y max-h-[52vh] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="text-tertiary text-body-sm px-3 py-8 text-center">
              Nothing matches “{text}”.
            </p>
          ) : (
            entries.map((entry, index) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              const Glyph = entry.icon;

              return (
                <div key={entry.id}>
                  {showGroup ? (
                    <p className="text-tertiary text-caption px-3 pt-3 pb-1 tracking-wide uppercase">
                      {entry.group}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    data-selected={index === selected}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => run(entry)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      index === selected ? 'bg-brand-soft' : 'hover:bg-surface-secondary',
                    )}
                  >
                    <Glyph
                      className={cn(
                        'h-4 w-4 shrink-0',
                        index === selected ? 'text-brand-hover' : 'text-tertiary',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-body-sm block truncate font-medium',
                          index === selected ? 'text-brand-strong' : 'text-primary',
                        )}
                      >
                        {entry.title}
                      </span>
                      {entry.subtitle ? (
                        <span className="text-tertiary text-caption block truncate">
                          {entry.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {entry.shortcut ? <KeyHint keys={entry.shortcut} /> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-default text-tertiary text-caption flex items-center gap-3 border-t px-4 py-2">
          <span className="flex items-center gap-1.5">
            <KeyHint keys="↑↓" /> move
          </span>
          <span className="flex items-center gap-1.5">
            <KeyHint keys="↵" /> open
          </span>
          <span className="ml-auto">Searches documents, memory and commands</span>
        </div>
      </div>
    </Dialog>
  );
}
