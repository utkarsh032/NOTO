import type { Id } from '@noto/types';
import { useEffect, useRef } from 'react';

import { CloseIcon, DocumentIcon, DotIcon, PlusIcon } from '../components/icons';
import { cn } from '../utils/cn';
import type { DocumentTab } from './use-document-tabs';

export interface TabBarProps {
  tabs: DocumentTab[];
  onSelect(id: Id): void;
  onClose(id: Id): void;
  /** Opens a new document in a new tab. Omitted where there is nowhere to put one. */
  onNew?(): void;
  className?: string;
}

/**
 * The open documents, as tabs.
 *
 * The strip is always there once anything is open, including for a single
 * document: it is the row that says which document the pane below belongs to,
 * and a bar that appears only on the second document makes the first one feel
 * like a different screen.
 */
export function TabBar({ tabs, onSelect, onClose, onNew, className }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <div
        role="tablist"
        aria-label="Open documents"
        aria-orientation="horizontal"
        /*
         * Scrolls rather than shrinking. A tab narrowed to fit is a tab whose
         * title cannot be read, which defeats the point of having one.
         */
        className="noto-scroll-x flex min-w-0 items-center gap-1 overflow-x-auto py-1.5"
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} tab={tab} onSelect={onSelect} onClose={onClose} />
        ))}
      </div>

      {onNew ? (
        <button
          type="button"
          onClick={onNew}
          aria-label="New document"
          title="New document"
          className="border-default text-tertiary hover:border-strong hover:text-primary hover:bg-surface-secondary focus-visible:outline-brand inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

interface TabProps {
  tab: DocumentTab;
  onSelect(id: Id): void;
  onClose(id: Id): void;
}

function Tab({ tab, onSelect, onClose }: TabProps) {
  const ref = useRef<HTMLDivElement>(null);

  /* A tab activated by keyboard, or restored at launch, may be off-screen. */
  useEffect(() => {
    if (!tab.isActive) return;
    ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab.isActive]);

  return (
    /*
     * The tab is a div holding two buttons rather than a button holding
     * another: nesting them is invalid, and the close control has to be
     * separately clickable and separately labelled.
     */
    <div
      ref={ref}
      role="tab"
      aria-selected={tab.isActive}
      className={cn(
        'group/tab flex h-9 shrink-0 items-center gap-1.5 rounded-md border pr-1 pl-2.5 transition-colors',
        tab.isActive
          ? 'border-brand bg-brand-soft text-brand-strong'
          : 'text-secondary hover:bg-surface-secondary hover:text-primary border-transparent',
      )}
    >
      <DocumentIcon
        className={cn('h-4 w-4 shrink-0', tab.isActive ? 'text-brand' : 'text-tertiary')}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => onSelect(tab.id)}
        /* Middle-click closes, as it does in every tabbed thing. */
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          onClose(tab.id);
        }}
        title={tab.title}
        className="text-body-sm focus-visible:outline-brand max-w-44 truncate py-1.5 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        {tab.title || 'Untitled'}
      </button>

      {/*
       * The dot and the close control share one slot: the dot says there is
       * unsaved work, and gives way on hover to the control that would discard
       * the view of it. Both are always reachable by keyboard.
       */}
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {tab.isDirty ? (
          <DotIcon
            className="text-brand h-4 w-4 group-focus-within/tab:opacity-0 group-hover/tab:opacity-0"
            aria-hidden="true"
          />
        ) : null}

        <button
          type="button"
          onClick={() => onClose(tab.id)}
          aria-label={`Close ${tab.title || 'Untitled'}`}
          className={cn(
            'text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand absolute inset-0 flex items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1',
            tab.isDirty && 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100',
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}
