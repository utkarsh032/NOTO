import type { Id } from '@noto/types';
import { useEffect, useRef, useState } from 'react';

import { CloseIcon, DocumentIcon, DotIcon, PinIcon, PlusIcon } from '../components/icons';
import { cn } from '../utils/cn';
import type { DocumentTab } from './use-document-tabs';

export interface TabBarProps {
  tabs: DocumentTab[];
  onSelect(id: Id): void;
  onClose(id: Id): void;
  onNew(): void;
  /** The tab menu's actions. Each is offered only when it is given. */
  onTogglePin?(id: Id): void;
  onDuplicate?(id: Id): void;
  onMove?(id: Id, delta: -1 | 1): void;
  onCloseOthers?(id: Id): void;
  onReopenClosed?(): void;
  canReopen?: boolean;
  className?: string;
}

interface MenuState {
  id: Id;
  x: number;
  y: number;
}

/**
 * The open documents, as tabs.
 *
 * They are shaped the way every browser shapes them, because that is the shape
 * people already know how to read: one continuous row with no gaps between the
 * tabs, hairlines rather than space telling neighbours apart, and the open one
 * carrying the colour of the page it belongs to, sitting over the header's
 * bottom rule so that tab and document are visibly one surface. Detached pills
 * with air around them read as buttons that happen to be in a row; only the
 * open one being joined to what is underneath says which document the pane
 * below is showing.
 *
 * The strip reaches the top of the window rather than floating in a band below
 * it. A tab is the top edge of the page it opens, and a strip with empty chrome
 * above it reads as a toolbar that happens to contain tabs. This is why the
 * header is the height of a tab and not a hand's breadth more.
 *
 * Every tab is the same width and gives up width together as more open, down
 * to a floor where a title is still worth reading. Past that the strip scrolls
 * — with no scrollbar, since a bar across the bottom would cut the open tab
 * away from the page again.
 *
 * The strip is always there once anything is open, including for a single
 * document: it is the row that says which document the pane below belongs to,
 * and a bar that appears only on the second document makes the first one feel
 * like a different screen.
 *
 * New sits after the last tab, where a tabbed thing puts it, and outside the
 * scroller rather than inside it — a control that scrolls out of reach once
 * enough documents are open is a control that is missing exactly when it is
 * most wanted. The header drops its own New while the strip is showing, so
 * there is one of them on screen and never two.
 */
export function TabBar(props: TabBarProps) {
  const { tabs, onSelect, onClose, onNew, className } = props;
  const [menu, setMenu] = useState<MenuState | null>(null);

  if (tabs.length === 0) return null;

  return (
    <div className={cn('flex min-w-0 items-stretch', className)}>
      <div
        role="tablist"
        aria-label="Open documents"
        aria-orientation="horizontal"
        /*
         * The negative margin is what joins the strip to the document: it pulls
         * the row one pixel past the header's content edge, so the open tab's
         * own fill covers the rule underneath it and the two become one surface.
         */
        /*
         * Content width, not `flex-1`. Growing to fill would strand New at the
         * far edge of the window with a gulf between it and the last tab; the
         * row is only as wide as the tabs in it, so New sits against the last
         * one. It still shrinks and scrolls when the tabs outgrow the space,
         * which is what `min-w-0` is for.
         */
        className="noto-tabs -mb-px flex min-w-0 shrink items-stretch"
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            tab={tab}
            /*
             * A hairline stands between two closed tabs and nowhere else. Beside
             * the open one its own outline already draws that edge, and a second
             * line a pixel away would read as a seam.
             */
            divided={!tab.isActive && !tabs[index + 1]?.isActive && index < tabs.length - 1}
            onSelect={onSelect}
            onClose={onClose}
            onMenu={(x, y) => setMenu({ id: tab.id, x, y })}
          />
        ))}
      </div>

      {/* Vertically centred rather than stretched: it is a control beside the
          row, not another tab, and a full-height target would read as one. */}
      <button
        type="button"
        onClick={onNew}
        aria-label="New document"
        title="New document"
        className="text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand my-auto ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <PlusIcon className="h-4 w-4" />
      </button>

      {menu ? <TabMenu {...props} menu={menu} onDismiss={() => setMenu(null)} /> : null}
    </div>
  );
}

/**
 * The tab's own menu, on a right click — or Shift+F10 and the Menu key, which
 * the browser reports as the same event, so the keyboard reaches it too.
 */
function TabMenu({
  tabs,
  menu,
  onDismiss,
  onClose,
  onTogglePin,
  onDuplicate,
  onMove,
  onCloseOthers,
  onReopenClosed,
  canReopen,
}: TabBarProps & { menu: MenuState; onDismiss(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const index = tabs.findIndex((tab) => tab.id === menu.id);
  const tab = tabs[index];

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onDismiss]);

  if (!tab) return null;

  const neighbourLeft = tabs[index - 1];
  const neighbourRight = tabs[index + 1];

  const items: { label: string; run: () => void; disabled?: boolean }[] = [
    ...(onTogglePin
      ? [{ label: tab.isPinned ? 'Unpin tab' : 'Pin tab', run: () => onTogglePin(tab.id) }]
      : []),
    ...(onDuplicate ? [{ label: 'Duplicate', run: () => onDuplicate(tab.id) }] : []),
    ...(onMove
      ? [
          {
            label: 'Move left',
            run: () => onMove(tab.id, -1),
            disabled: !neighbourLeft || neighbourLeft.isPinned !== tab.isPinned,
          },
          {
            label: 'Move right',
            run: () => onMove(tab.id, 1),
            disabled: !neighbourRight || neighbourRight.isPinned !== tab.isPinned,
          },
        ]
      : []),
    { label: 'Close', run: () => onClose(tab.id) },
    ...(onCloseOthers
      ? [{ label: 'Close others', run: () => onCloseOthers(tab.id), disabled: tabs.length < 2 }]
      : []),
    ...(onReopenClosed
      ? [{ label: 'Reopen closed tab', run: onReopenClosed, disabled: !canReopen }]
      : []),
  ];

  const focusStep = (step: 1 | -1) => {
    const entries = [
      ...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []),
    ];
    const at = entries.indexOf(document.activeElement as HTMLElement);
    entries[(at + step + entries.length) % entries.length]?.focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Tab: ${tab.title || 'Untitled'}`}
      style={{ left: menu.x, top: menu.y }}
      className="border-default bg-surface fixed z-50 min-w-44 rounded-lg border py-1 shadow-lg"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onDismiss();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          focusStep(event.key === 'ArrowDown' ? 1 : -1);
        }
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            onDismiss();
            item.run();
          }}
          className="text-primary text-body-sm hover:bg-surface-secondary focus-visible:bg-surface-secondary block w-full px-3 py-1.5 text-left outline-none disabled:opacity-40"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface TabProps {
  tab: DocumentTab;
  /** Whether this tab draws the hairline that separates it from the next. */
  divided: boolean;
  onSelect(id: Id): void;
  onClose(id: Id): void;
  /** Opens the tab's menu at a point on screen. */
  onMenu(x: number, y: number): void;
}

function Tab({ tab, divided, onSelect, onClose, onMenu }: TabProps) {
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
      onContextMenu={(event) => {
        event.preventDefault();
        // A keyboard-opened menu has no pointer position; use the tab's corner.
        const box = event.currentTarget.getBoundingClientRect();
        onMenu(event.clientX || box.left + 8, event.clientY || box.bottom);
      }}
      className={cn(
        'group/tab relative flex w-44 min-w-32 items-center gap-1.5 overflow-hidden rounded-t-lg border-x border-t pr-1 pl-2.5 transition-colors',
        /*
         * The separator, on the tab's own trailing edge. It gives way while
         * either of the two tabs it stands between is under the pointer, which
         * is the moment one of them stops being a neighbour and starts being
         * the thing you are about to click.
         */
        'after:bg-default after:absolute after:top-1/2 after:right-0 after:h-5 after:w-px after:-translate-y-1/2 after:transition-opacity after:content-[""]',
        'hover:after:opacity-0 [&:has(+*:hover)]:after:opacity-0',
        !divided && 'after:opacity-0',
        tab.isActive
          ? /* The colour of the page below, and no rule between them. */
            'border-default bg-background text-primary after:opacity-0'
          : 'text-secondary hover:bg-surface hover:text-primary border-transparent',
      )}
    >
      {/* The one mark that survives at a glance: which document is in front.
          The fills either side of it are a shade apart, the accent is not. */}
      {tab.isActive ? (
        <span className="bg-brand absolute inset-x-0 top-0 h-0.5" aria-hidden="true" />
      ) : null}

      {tab.isPinned ? (
        <PinIcon
          className={cn('h-3.5 w-3.5 shrink-0', tab.isActive ? 'text-brand' : 'text-tertiary')}
          aria-label="Pinned"
        />
      ) : (
        <DocumentIcon
          className={cn('h-4 w-4 shrink-0', tab.isActive ? 'text-brand' : 'text-tertiary')}
          aria-hidden="true"
        />
      )}

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
        className="text-body-sm focus-visible:outline-brand min-w-0 flex-1 truncate py-1.5 text-left font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
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
            'text-tertiary hover:bg-surface-tertiary hover:text-primary focus-visible:outline-brand absolute inset-0 flex items-center justify-center rounded transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1',
            tab.isDirty && 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100',
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}
