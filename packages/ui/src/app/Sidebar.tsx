import { useSettingsStore, useUiStore } from '@noto/core';
import { useMemo } from 'react';

import notoIcon from '../assets/noto-icon.png';
import notoWordmark from '../assets/noto-wordmark.png';
import { Button } from '../components/Button';
import { KeyHint } from '../components/KeyHint';
import { Skeleton } from '../components/Skeleton';
import { SyncStatus } from '../components/SyncStatus';
import { ClockIcon, PinIcon, PlusIcon } from '../components/icons';
import { QuickNoteIllustration } from '../components/illustrations';
import { cn } from '../utils/cn';
import { NavItem } from './NavItem';
import { SidebarDocumentList } from './SidebarDocumentList';
import { SidebarToggle } from './SidebarToggle';
import { SidebarUpdateButton, SidebarVersion } from './SidebarUpdate';
import { useNotoData } from './data-context';
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
 * One unbroken list of destinations, where there used to be two separated by a
 * rule. Settings and Account were the second group, and they are gone from here
 * deliberately: they are about the person rather than about the work, the avatar
 * in the header already leads to both, and a destination listed in two places is
 * a destination you have to choose a route to.
 */
export function Sidebar({ route, onQuickNote, quickNoteShortcut }: SidebarProps) {
  const { workspace, documents, activeDocument, updateDocument, deleteDocument } = useNotoData();
  const tabs = useDocumentTabs();
  const actions = useNotoActions();

  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const syncEnabled = useSettingsStore((state) => state.settings.syncEnabled);

  /* Noto is local-first: with sync off, "saved on this device" is the truth. */
  const syncState = syncEnabled ? 'idle' : 'disabled';

  const pinned = useMemo(
    () => (documents ?? []).filter((document) => document.isFavorite),
    [documents],
  );

  /*
   * The brand bar matches the global header's height, so the rule under the two
   * of them is a single unbroken line across the window — and the mark holds
   * the same centre line whether the sidebar is open or collapsed, instead of
   * hopping when it is toggled.
   */
  const brandBar = 'border-default flex h-header shrink-0 items-center border-b';

  /*
   * Collapsed, the sidebar keeps a 72px rail rather than disappearing: the mark
   * is what tells the eye the panel is still there, and the destinations stay
   * reachable as icons. The way back is the handle on the rail's edge, which is
   * the same control, in the same place, that put it here.
   */
  if (collapsed) {
    return (
      <aside className="noto-print-hidden bg-surface-secondary border-default w-sidebar-collapsed relative flex h-full shrink-0 flex-col border-r">
        <SidebarToggle />

        <div className={cn(brandBar, 'justify-center')}>
          {/* A mark, not a control. Collapsing and expanding belong to the
              handle on the divider, which is in the same place either way. */}
          <img src={notoIcon} alt="Noto" className="h-8 w-8" draggable={false} />
        </div>

        <div className="flex flex-col items-center py-3">
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

        <div className="flex flex-col items-center gap-2 pb-3">
          <SidebarUpdateButton collapsed />
          <SyncStatus status={syncState} variant="rail" />
          {/* The rail has no room for the name, and none is needed: the number
              under the mark can only be one thing's version. */}
          <SidebarVersion collapsed />
        </div>
      </aside>
    );
  }

  return (
    <aside className="noto-print-hidden bg-surface-secondary border-default w-sidebar relative flex h-full shrink-0 flex-col border-r">
      <SidebarToggle />

      <header className={cn(brandBar, 'items-center px-5')}>
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* The wordmark carries the product name, so the alt text is the name
              itself rather than a description of the picture. */}
          <img src={notoWordmark} alt="Noto" className="h-6 w-auto self-start" draggable={false} />
          {/* What Noto is for, in three words. It sits under the mark rather
              than being read out as part of it. */}
          <p className="text-tertiary text-caption truncate">Write. Remember. Find.</p>
        </div>
      </header>

      <div className="px-3 pt-4 pb-2">
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
              onDelete={(id) => void deleteDocument(id)}
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
              onDelete={(id) => void deleteDocument(id)}
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

      <div className="border-default border-t px-4 py-3">
        <SidebarUpdateButton />
        <div className="flex items-center justify-between gap-2">
          <SyncStatus status={syncState} />
          <SidebarVersion />
        </div>
      </div>
    </aside>
  );
}
