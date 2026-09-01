import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import notoIcon from '../../assets/noto-icon.png';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClipboardIcon,
  CloseIcon,
  DocumentIcon,
  GripIcon,
  MaximizeIcon,
  SearchIcon,
  SparklesIcon,
  type IconProps,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';
import {
  readQuickNoteDraft,
  subscribeToQuickNoteDraft,
  writeQuickNoteDraft,
} from '../quick-note-draft';
import type { DockSide } from './dock-placement';

/** One of the recent documents the panel offers a way back into. */
export interface DockRecentDocument {
  id: string;
  title: string;
  updatedAt: string;
}

export interface DockPanelProps {
  side: DockSide;
  onClose(): void;
  /** Moves the dock to the other edge. */
  onFlipSide(): void;
  /** Turns the current draft into a document. The panel clears it on success. */
  onSave(text: string): Promise<void> | void;
  /** Brings the full application forward — a window on desktop, a route on the web. */
  onOpenNoto(): void;
  onQuickPaste(): void;
  onSearch(): void;
  onAskAI(): void;
  recent?: DockRecentDocument[];
  onOpenRecent?(id: string): void;
  /** Lets the host make the panel's header a drag surface too. */
  onDragStart?(event: ReactPointerEvent<HTMLElement>): void;
  className?: string;
}

interface DockAction {
  id: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  tone: string;
  run(props: DockPanelProps): void;
}

/**
 * The four things worth doing without opening Noto.
 *
 * The same idea as the Smart Sidebar's rail, and the same reasoning: a fixed
 * set in a fixed order, learned by position, so nothing appears later and
 * pushes the rest along.
 */
const ACTIONS: DockAction[] = [
  {
    id: 'paste',
    label: 'Paste',
    icon: ClipboardIcon,
    tone: 'bg-info/10 text-info',
    run: (props) => props.onQuickPaste(),
  },
  {
    id: 'search',
    label: 'Search',
    icon: SearchIcon,
    tone: 'bg-surface-tertiary text-secondary',
    run: (props) => props.onSearch(),
  },
  {
    id: 'ai',
    label: 'Ask AI',
    icon: SparklesIcon,
    tone: 'bg-ai-soft text-ai',
    run: (props) => props.onAskAI(),
  },
  {
    id: 'open',
    label: 'Open Noto',
    icon: MaximizeIcon,
    tone: 'bg-brand-soft text-brand-hover',
    run: (props) => props.onOpenNoto(),
  },
];

/**
 * What the dock opens into.
 *
 * A phone's edge panel, on a desktop: narrow, anchored to the side the handle
 * was on, and built around the one thing somebody reaching for the edge of the
 * screen wanted — a field to type a thought into. Everything else is one row of
 * four buttons and a short list of where you were.
 *
 * It writes the same draft as the Quick Note window and the Quick Notes screen,
 * which is what makes the dock a way *into* Noto rather than a second, smaller
 * Noto that keeps its own notes somewhere you will not find them.
 */
export function DockPanel(props: DockPanelProps) {
  const {
    side,
    onClose,
    onFlipSide,
    onSave,
    recent = [],
    onOpenRecent,
    onDragStart,
    className,
  } = props;

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const draft = useSyncExternalStore(subscribeToQuickNoteDraft, readQuickNoteDraft, () => '');

  useEffect(() => {
    const frame = requestAnimationFrame(() => areaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const save = () => {
    const value = draft.trim();
    if (value === '') return;

    void Promise.resolve(onSave(value)).then(() => writeQuickNoteDraft(''));
  };

  const FlipGlyph = side === 'right' ? ArrowLeftIcon : ArrowRightIcon;

  return (
    <section
      aria-label="Quick Note dock"
      className={cn(
        'noto-print-hidden border-default bg-surface flex w-full flex-col overflow-hidden border shadow-[var(--noto-shadow-lg)]',
        side === 'right' ? 'rounded-l-2xl border-r-0' : 'rounded-r-2xl border-l-0',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <header
        onPointerDown={onDragStart}
        className={cn(
          'border-default flex shrink-0 items-center gap-1.5 border-b py-2 pr-2 pl-3',
          onDragStart && 'cursor-grab',
        )}
      >
        {onDragStart ? <GripIcon className="text-disabled h-4 w-4 shrink-0" /> : null}
        <img src={notoIcon} alt="" draggable={false} className="h-5 w-5 shrink-0" />
        <h2 className="text-primary text-body-sm min-w-0 flex-1 truncate font-semibold">
          Quick Note
        </h2>

        <IconButton
          label={side === 'right' ? 'Move dock to the left edge' : 'Move dock to the right edge'}
          size="sm"
          icon={<FlipGlyph className="h-4 w-4" />}
          onClick={onFlipSide}
        />
        <IconButton
          label="Close the dock panel"
          size="sm"
          icon={<CloseIcon className="h-4 w-4" />}
          onClick={onClose}
        />
      </header>

      <textarea
        ref={areaRef}
        value={draft}
        onChange={(event) => writeQuickNoteDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
        }}
        rows={7}
        aria-label="Quick note"
        placeholder="Write it down before it goes…"
        className="text-primary placeholder:text-disabled text-body min-h-36 w-full flex-1 resize-none bg-transparent px-4 py-3 leading-relaxed outline-none"
      />

      <div className="border-default shrink-0 border-t px-3 py-2.5">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          disabled={draft.trim() === ''}
          onClick={save}
          leading={<DocumentIcon className="h-4 w-4" />}
        >
          Save as document
        </Button>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {ACTIONS.map((action) => {
            const Glyph = action.icon;

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => action.run(props)}
                className={cn(
                  'hover:bg-surface-secondary focus-visible:outline-brand flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors focus-visible:outline-2',
                )}
              >
                <span
                  className={cn('flex h-8 w-8 items-center justify-center rounded-md', action.tone)}
                >
                  <Glyph className="h-4 w-4" />
                </span>
                <span className="text-tertiary text-caption text-center leading-tight">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {recent.length > 0 && onOpenRecent ? (
        <div className="border-default noto-scroll-y max-h-40 shrink-0 overflow-y-auto border-t px-3 py-2">
          <h3 className="text-tertiary text-caption px-1 pb-1 tracking-wide uppercase">Recent</h3>
          <ul className="flex flex-col gap-0.5">
            {recent.slice(0, 4).map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  onClick={() => onOpenRecent(document.id)}
                  className="hover:bg-surface-secondary focus-visible:outline-brand flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2"
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
        </div>
      ) : null}
    </section>
  );
}
