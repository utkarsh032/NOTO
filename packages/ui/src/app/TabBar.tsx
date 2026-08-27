import type { Id } from '@noto/types';
import { useEffect, useRef } from 'react';

import { CloseIcon, DotIcon } from '../components/icons';
import { cn } from '../utils/cn';
import type { DocumentTab } from './use-document-tabs';

export interface TabBarProps {
  tabs: DocumentTab[];
  onSelect(id: Id): void;
  onClose(id: Id): void;
  className?: string;
}

/**
 * The open documents, as tabs.
 *
 * Nothing is rendered when a single document is open: one tab is a label, not a
 * choice, and the bar would be a permanent strip of chrome earning its height
 * only in the case it does not apply to.
 */
export function TabBar({ tabs, onSelect, onClose, className }: TabBarProps) {
  if (tabs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Open documents"
      aria-orientation="horizontal"
      /*
       * Scrolls rather than shrinking. A tab narrowed to fit is a tab whose
       * title cannot be read, which defeats the point of having one.
       */
      className={cn('flex items-stretch gap-1 overflow-x-auto', className)}
    >
      {tabs.map((tab) => (
        <Tab key={tab.id} tab={tab} onSelect={onSelect} onClose={onClose} />
      ))}
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
        'group/tab flex shrink-0 items-center gap-1 rounded-t-md border-b-2 pr-1 pl-3 transition-colors',
        tab.isActive
          ? 'border-brand bg-surface text-primary'
          : 'text-secondary hover:bg-surface hover:text-primary border-transparent',
      )}
    >
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
        className="text-body-sm focus-visible:outline-brand max-w-44 truncate py-2 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
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
            'text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand absolute inset-0 flex items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1',
            tab.isDirty && 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100',
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}
