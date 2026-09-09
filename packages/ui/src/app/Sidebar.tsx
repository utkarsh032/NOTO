import { useSettingsStore, useUiStore } from '@noto/core';
import type { ThemeMode, User } from '@noto/types';
import { useMemo } from 'react';

import notoIcon from '../assets/noto-icon.png';
import notoWordmark from '../assets/noto-wordmark.png';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { KeyHint } from '../components/KeyHint';
import { Skeleton } from '../components/Skeleton';
import { SyncStatus } from '../components/SyncStatus';
import { ThemeToggle } from '../components/ThemeToggle';
import { ClockIcon, PinIcon, PlusIcon, SearchIcon } from '../components/icons';
import { QuickNoteIllustration } from '../components/illustrations';
import { cn } from '../utils/cn';
import { NavItem } from './NavItem';
import { UserMenu } from './UserMenu';
import { SidebarDocumentList } from './SidebarDocumentList';
import { SidebarToggle } from './SidebarToggle';
import { SidebarUpdateButton, SidebarVersion } from './SidebarUpdate';
import { useNotoData } from './data-context';
import { useDocumentOperations } from './documents/use-document-operations';
import { PRIMARY_NAV, isEntryActive } from './navigation';
import { navigate } from './router';
import type { Route } from './router';
import { useDocumentTabs } from './use-document-tabs';
import { useNotoActions } from './use-noto-actions';

export interface SidebarProps {
  route: Route;
  /** Opens the floating Quick Note window. */
  onQuickNote(): void;
  /** Formatted for this platform — "Ctrl Alt N" or "⌥⌘N". */
  quickNoteShortcut: string;
  /** Opens the command palette, which is also where searching starts. */
  onSearch(): void;
  /** Formatted for this platform — "Ctrl K" or "⌘K". */
  searchShortcut: string;
  /** `null` when nobody is signed in. The menu still opens; the identity does not. */
  user: User | null;
  theme: ThemeMode;
  onTheme(mode: ThemeMode): void;
  onOpenAccount(): void;
  onOpenSettings(): void;
  onOpenShortcuts(): void;
  /** Opens the plan comparison. */
  onOpenPlans(): void;
  /** Ends the session, which lands on the sign-in screen. */
  onSignOut(): void;
}

/**
 * The sidebar.
 *
 * Quiet by design: a light secondary surface rather than a dark full-height
 * navigation, and the brand colour spent only on the active row and the New
 * Document button. Navigation sits at the top, the documents themselves fill
 * the middle, and the two things that are always true — how to jot something
 * down, and whether the work is safe — are pinned to the bottom where they can
 * be found without reading.
 *
 * Everything about the person rather than about the work is here too, because
 * there is no application bar above the window any more: search at the top
 * where the eye starts, appearance and the account in the footer. The header
 * that used to hold those three is the document tabs now.
 *
 * Settings and Account are still not rows in the navigation list. They are one
 * menu behind the avatar in the footer, which is where everyone looks first for
 * anything about themselves, and a destination listed in two places is a
 * destination you have to choose a route to.
 *
 * Collapsing is a movement, not a swap. The frame is one element whose width is
 * animated between the two sizes; the panel inside keeps whichever width it was
 * drawn at and is clipped by the frame, so the sidebar slides out from under its
 * own edge instead of every line inside it reflowing on the way. Both timings
 * read `--noto-duration-*`, which a reduced-motion preference has already set to
 * zero — the sidebar then simply changes size.
 */
export function Sidebar({
  route,
  onQuickNote,
  quickNoteShortcut,
  onSearch,
  searchShortcut,
  user,
  theme,
  onTheme,
  onOpenAccount,
  onOpenSettings,
  onOpenShortcuts,
  onOpenPlans,
  onSignOut,
}: SidebarProps) {
  const { workspace, documents, activeDocument, updateDocument } = useNotoData();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();
  /*
   * Deleting is asked properly, in the same dialog Home, Documents and the
   * workspace use. The sidebar used to answer for itself with a pair of buttons
   * under the row, which meant the one list you delete from most often was the
   * one place the question was quietest.
   */
  const operations = useDocumentOperations();

  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const syncEnabled = useSettingsStore((state) => state.settings.syncEnabled);

  /* Noto is local-first: with sync off, "saved on this device" is the truth. */
  const syncState = syncEnabled ? 'idle' : 'disabled';

  const pinned = useMemo(
    () => (documents ?? []).filter((document) => document.isFavorite),
    [documents],
  );

  /*
   * The same menu in both states, so the rail and the panel are one control
   * that changes size rather than two that have to be kept in agreement.
   */
  const accountMenu = (compact: boolean) => (
    <UserMenu
      compact={compact}
      /* It sits at the bottom, so it opens upward; and it hangs from the
         avatar's left edge, so that in the rail it opens out over the content
         rather than off the left of the window. */
      side="top"
      align="left"
      user={user}
      onOpenAccount={onOpenAccount}
      onOpenSettings={onOpenSettings}
      onOpenShortcuts={onOpenShortcuts}
      onOpenPlans={onOpenPlans}
      onSignOut={onSignOut}
      className={compact ? undefined : 'min-w-0 flex-1'}
    />
  );

  /*
   * The brand bar matches the height of the bar of tabs beside it, so the rule
   * under the two of them is a single unbroken line across the window — and the
   * mark holds
   * the same centre line whether the sidebar is open or collapsed, instead of
   * hopping when it is toggled.
   */
  const brandBar = 'border-default flex h-header shrink-0 items-center border-b';

  /*
   * The width the panel is drawn at. The frame animates to it; the panel inside
   * takes it immediately, and the gap between those two is the whole effect.
   */
  const width = collapsed ? 'var(--spacing-sidebar-collapsed)' : 'var(--spacing-sidebar)';

  /*
   * Collapsed, the sidebar keeps a 72px rail rather than disappearing: the mark
   * is what tells the eye the panel is still there, and the destinations stay
   * reachable as icons. The way back is the handle on the rail's edge, which is
   * the same control, in the same place, that put it here.
   */
  const rail = (
    <>
      <div className={cn(brandBar, 'justify-center')}>
        {/* The mark is the way home, which is the one thing a logo is expected
              to do. Collapsing and expanding still belong to the handle on the
              divider, which is in the same place either way. */}
        <button
          type="button"
          onClick={() => navigate({ name: 'home' })}
          aria-label="Noto — go to Home"
          title="Home"
          className="focus-visible:outline-brand rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <img src={notoIcon} alt="" className="h-8 w-8" draggable={false} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 py-3">
        {/* Search first, then the thing to write in — the same order the panel
              puts them in, so collapsing the sidebar does not reshuffle it.
              Named as the panel names it, because the navigation below has a
              Search of its own with the same glyph that goes somewhere else. */}
        <IconButton
          label="Search everything"
          icon={<SearchIcon className="h-5 w-5" />}
          onClick={onSearch}
          variant="surface"
        />

        <button
          type="button"
          onClick={() => void actions.newDocument()}
          aria-label="New document"
          title="New document"
          className="bg-brand text-on-brand hover:bg-brand-hover focus-visible:ring-brand focus-visible:ring-offset-surface-secondary flex h-9 w-9 items-center justify-center rounded-md shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <nav
        aria-label="Primary"
        className="noto-scroll flex flex-1 flex-col items-center gap-1 overflow-y-auto py-1"
      >
        {PRIMARY_NAV.map((entry) => (
          <NavItem
            key={entry.id}
            collapsed
            label={entry.label}
            icon={<entry.icon className="h-5 w-5" />}
            isActive={isEntryActive(entry, route)}
            onSelect={() => navigate(entry.route)}
          />
        ))}
      </nav>

      <div className="border-default flex flex-col items-center gap-2 border-t pt-3 pb-3">
        <SidebarUpdateButton collapsed />
        {/* Account then appearance, the order the panel's footer reads in. */}
        {accountMenu(true)}
        <ThemeToggle value={theme} onChange={onTheme} />
        <SyncStatus status={syncState} variant="rail" />
        {/* The rail has no room for the name, and none is needed: the number
              under the mark can only be one thing's version. */}
        <SidebarVersion collapsed />
      </div>
    </>
  );

  const full = (
    <>
      <header className={cn(brandBar, 'items-center px-5')}>
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* The wordmark is the way home. It carries the product name and the
              destination together, so the label is on the button and the image
              itself is left silent rather than being read out twice. */}
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            aria-label="Noto — go to Home"
            title="Home"
            className="focus-visible:outline-brand self-start rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <img src={notoWordmark} alt="" className="h-6 w-auto" draggable={false} />
          </button>
          {/* What Noto is for, in three words. It sits under the mark rather
              than being read out as part of it. */}
          <p className="text-tertiary text-caption truncate">Write. Remember. Find.</p>
        </div>
      </header>

      {/*
       * Search, where the header used to keep it. A button rather than an
       * input: what it opens is the command palette, which searches documents,
       * memory and commands together, and a field here would only collect a
       * query the palette then has to be handed.
       */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onSearch}
          className="border-default bg-surface hover:border-strong focus-visible:border-brand focus-visible:ring-brand-muted flex h-9 w-full items-center gap-2 rounded-md border px-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
        >
          <SearchIcon className="text-tertiary h-4 w-4 shrink-0" />
          <span className="text-tertiary text-body-sm min-w-0 flex-1 truncate">
            Search everything
          </span>
          <KeyHint keys={searchShortcut} />
        </button>
      </div>

      <div className="px-3 pt-2 pb-2">
        <Button
          variant="primary"
          onClick={() => void actions.newDocument()}
          leading={<PlusIcon className="h-5 w-5" />}
          className="w-full"
        >
          New Document
        </Button>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-3 pt-2">
        {PRIMARY_NAV.map((entry) => (
          <NavItem
            key={entry.id}
            label={entry.label}
            icon={<entry.icon className="h-5 w-5" />}
            isActive={isEntryActive(entry, route)}
            onSelect={() => navigate(entry.route)}
          />
        ))}
      </nav>

      {/*
       * The documents themselves. This is the part that scrolls; everything
       * above and below it stays where the hand last found it.
       */}
      <div className="noto-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {pinned.length > 0 ? (
          <section className="mb-5" aria-labelledby="noto-pinned-heading">
            <h2
              id="noto-pinned-heading"
              className="text-tertiary text-caption flex items-center gap-1.5 px-2.5 pb-1 tracking-wide uppercase"
            >
              <PinIcon className="h-3.5 w-3.5" />
              Pinned
            </h2>
            <SidebarDocumentList
              showPin
              documents={pinned}
              activeId={activeDocument?.id ?? null}
              label="Pinned documents"
              onOpen={actions.openDocument}
              onRename={(id, title) => void updateDocument(id, { title })}
              onDelete={operations.remove}
            />
          </section>
        ) : null}

        <section aria-labelledby="noto-documents-heading">
          {/* Read against the list it labels, this says which workspace these are. */}
          <h2
            id="noto-documents-heading"
            className="text-tertiary text-caption truncate px-2.5 pb-1 tracking-wide uppercase"
          >
            {workspace?.name ?? 'Documents'}
          </h2>

          {documents === undefined ? (
            /* A skeleton in the shape of the list, rather than a spinner in a
               sidebar-sized hole. */
            <ul className="flex flex-col gap-1" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="px-2.5 py-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="mt-1.5 h-3 w-1/2" />
                </li>
              ))}
            </ul>
          ) : documents.length === 0 ? (
            <p className="text-tertiary text-caption px-2.5 py-3">
              No documents yet. Start one and it will appear here.
            </p>
          ) : (
            <SidebarDocumentList
              documents={documents}
              activeId={activeDocument?.id ?? null}
              label="All documents"
              onOpen={actions.openDocument}
              onRename={(id, title) => void updateDocument(id, { title })}
              onDelete={operations.remove}
            />
          )}
        </section>

        {/*
         * Documents opened before and since closed. This is what "recent
         * files" means in an application with no file dialog: the way back to
         * something you were working on without hunting the whole list.
         */}
        {tabs.recent.length > 0 ? (
          <section className="mt-6" aria-labelledby="noto-recent-heading">
            <h2
              id="noto-recent-heading"
              className="text-tertiary text-caption flex items-center gap-1.5 px-2.5 pb-1 tracking-wide uppercase"
            >
              <ClockIcon className="h-3.5 w-3.5" />
              Recent
            </h2>
            <ul className="flex flex-col gap-0.5">
              {tabs.recent.slice(0, 5).map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => actions.openDocument(document.id)}
                    className="text-secondary hover:bg-surface hover:text-primary focus-visible:outline-brand text-body-sm w-full truncate rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    {document.title || 'Untitled'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Quick Note, promoted. It is the one thing in Noto that is meant to be
          reached without looking, so the card exists to teach the shortcut. */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onQuickNote}
          className="border-default bg-surface hover:border-strong focus-visible:outline-brand flex w-full flex-col items-center gap-1 rounded-xl border px-4 py-4 text-center transition-colors hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <QuickNoteIllustration className="h-11 w-11" />
          <span className="text-primary text-body-sm font-semibold">Quick Note</span>
          <span className="text-tertiary text-caption">
            Jot down ideas instantly, anytime, anywhere.
          </span>
          <KeyHint keys={quickNoteShortcut} className="mt-1.5" />
        </button>
      </div>

      <div className="border-default border-t px-3 py-3">
        <SidebarUpdateButton />

        {/*
         * Who you are, and how Noto looks. Both lived in the header until the
         * header became the tabs, and both belong to the session rather than
         * to the document — which is this end of this panel.
         */}
        <div className="flex items-center gap-1">
          {accountMenu(false)}
          <ThemeToggle value={theme} onChange={onTheme} className="shrink-0" />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
          <SyncStatus status={syncState} />
          <SidebarVersion />
        </div>
      </div>
    </>
  );

  const frame = (
    <aside
      className="noto-print-hidden bg-surface-secondary border-default relative flex h-full shrink-0 flex-col border-r transition-[width] ease-out"
      style={{ width, transitionDuration: 'var(--noto-duration-slow)' }}
    >
      {/* Outside the clip, because half of it overhangs the divider. */}
      <SidebarToggle />

      {/* The clip. The panel inside is drawn at its own full width, so the frame
          narrowing over it hides the panel rather than squeezing it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          /* Keyed on the state, so each side is a fresh panel — which is what
             gives the incoming one something to fade in from. */
          key={collapsed ? 'rail' : 'full'}
          className="noto-sidebar-panel flex min-h-0 flex-1 flex-col"
          style={{ width }}
        >
          {collapsed ? rail : full}
        </div>
      </div>
    </aside>
  );

  /* The dialogs are modal and fixed, so they belong beside the sidebar rather
     than inside a panel that clips and animates its own width. */
  return (
    <>
      {frame}
      {operations.dialogs}
    </>
  );
}
