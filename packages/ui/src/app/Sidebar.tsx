import { useUiStore } from '@noto/core';
import type { Id } from '@noto/types';
import { useEffect, useRef, useState } from 'react';

import notoIcon from '../assets/noto-icon.png';
import notoWordmark from '../assets/noto-wordmark.png';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import {
  ClockIcon,
  DocumentIcon,
  PencilIcon,
  PlusIcon,
  SidebarIcon,
  TrashIcon,
} from '../components/icons';
import { EmptyPageIllustration } from '../components/illustrations';
import { cn } from '../utils/cn';
import { useNotoData } from './data-context';
import { useDocumentTabs } from './use-document-tabs';

/**
 * The sidebar.
 *
 * Quiet by design: a light secondary surface rather than a dark full-height
 * navigation, few separators, and the brand colour spent only on the active
 * row. The document list is the thing here; everything else gets out of its way.
 */
export function Sidebar() {
  const { workspace, documents, activeDocument, updateDocument, deleteDocument } = useNotoData();
  const tabs = useDocumentTabs();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  /*
   * Deleting is confirmed inline rather than in a modal: the row itself asks,
   * and anything else in the list dismisses the question.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  /* Renaming happens in place, in the row, rather than in a dialog about it. */
  const [renamingId, setRenamingId] = useState<Id | null>(null);

  /*
   * The brand bar matches the global header's height, so the rule under the two
   * of them is a single unbroken line across the window — and the mark holds
   * the same centre line whether the sidebar is open or collapsed, instead of
   * hopping when it is toggled.
   */
  const brandBar = 'border-default flex h-header shrink-0 items-center border-b';

  /*
   * Collapsed, the sidebar keeps a 72px rail rather than disappearing: the mark
   * is what tells the eye the panel is still there, and clicking it is the
   * shortest way back without hunting for the toggle in the header.
   */
  if (collapsed) {
    return (
      <aside className="bg-surface-secondary border-default w-sidebar-collapsed flex h-full shrink-0 flex-col border-r">
        <div className={cn(brandBar, 'justify-center')}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="hover:bg-surface focus-visible:outline-brand rounded-lg p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <img src={notoIcon} alt="" className="h-8 w-8" draggable={false} />
          </button>
        </div>

        <div className="flex flex-col items-center py-3">
          <button
            type="button"
            onClick={() => void tabs.create()}
            aria-label="New document"
            title="New document"
            className="bg-brand text-on-brand hover:bg-brand-hover focus-visible:ring-brand focus-visible:ring-offset-surface-secondary flex h-9 w-9 items-center justify-center rounded-md shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-surface-secondary border-default w-sidebar flex h-full shrink-0 flex-col border-r">
      <header className={cn(brandBar, 'justify-between gap-2 px-5')}>
        {/* The wordmark carries the product name, so the alt text is the name
            itself rather than a description of the picture. */}
        <img src={notoWordmark} alt="Noto" className="h-6 w-auto" draggable={false} />
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          className="text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand -mr-1 flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <SidebarIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="px-3 pt-4 pb-3">
        <Button
          variant="primary"
          onClick={() => void tabs.create()}
          leading={<PlusIcon className="h-5 w-5" />}
          className="w-full"
        >
          New Document
        </Button>
      </div>

      {/* Read against the list it labels, this says which workspace these are. */}
      {workspace ? (
        <p className="text-tertiary text-caption truncate px-5 pt-1 pb-2 tracking-wide uppercase">
          {workspace.name}
        </p>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Documents">
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
          <EmptyState
            title="No documents yet"
            description="Create your first document and start writing."
            illustration={<EmptyPageIllustration />}
            className="px-2 py-8"
          />
        ) : (
          /* Named, because the sidebar holds two lists and a screen reader
             moving between them needs to be told which is which. */
          <ul className="flex flex-col gap-0.5" aria-label="All documents">
            {documents.map((document) => {
              const isActive = document.id === activeDocument?.id;

              if (renamingId === document.id) {
                return (
                  <li key={document.id}>
                    <RenameRow
                      title={document.title}
                      onCommit={(title) => {
                        setRenamingId(null);
                        if (title !== document.title) void updateDocument(document.id, { title });
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  </li>
                );
              }

              return (
                <li key={document.id} className="group/row relative">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(null);
                      tabs.open(document.id);
                    }}
                    onDoubleClick={() => setRenamingId(document.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-md py-2 pr-9 pl-2.5 text-left transition-colors',
                      'focus-visible:outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2',
                      isActive
                        ? 'bg-brand-soft text-brand-strong'
                        : 'text-secondary hover:bg-surface hover:text-primary',
                    )}
                  >
                    <DocumentIcon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        isActive ? 'text-brand' : 'text-disabled',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-body-sm block truncate font-medium">
                        {document.title}
                      </span>
                      {/* Neutral even on the active row: the tint and the title
                          colour carry the state, and a second green shouts. */}
                      <span className="text-tertiary text-caption block truncate font-normal">
                        {document.excerpt || 'Empty document'}
                      </span>
                    </span>
                  </button>

                  {confirmingId === document.id ? (
                    /* Sits below the row rather than over it, so the two choices
                       never cover the title they are about. */
                    <div className="flex items-center justify-end gap-1 px-2 pt-1 pb-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingId(null)}
                        aria-label={`Keep ${document.title}`}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setConfirmingId(null);
                          void deleteDocument(document.id);
                        }}
                        aria-label={`Confirm moving ${document.title} to trash`}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : (
                    /*
                     * Hidden until the row is hovered, but always reachable by
                     * keyboard — focus-visible brings them back.
                     */
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition group-hover/row:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => setRenamingId(document.id)}
                        aria-label={`Rename ${document.title}`}
                        title="Rename"
                        className={cn(
                          'text-tertiary hover:bg-surface hover:text-primary focus-visible:outline-brand',
                          'flex h-7 w-7 items-center justify-center rounded-sm focus-visible:opacity-100 focus-visible:outline-2',
                        )}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(document.id)}
                        aria-label={`Move ${document.title} to trash`}
                        title="Move to trash"
                        className={cn(
                          'text-tertiary hover:bg-surface hover:text-danger focus-visible:outline-brand',
                          'flex h-7 w-7 items-center justify-center rounded-sm focus-visible:opacity-100 focus-visible:outline-2',
                        )}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

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
                    onClick={() => tabs.open(document.id)}
                    className="text-secondary hover:bg-surface hover:text-primary focus-visible:outline-brand text-body-sm w-full truncate rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    {document.title || 'Untitled'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </nav>
    </aside>
  );
}

interface RenameRowProps {
  title: string;
  onCommit(title: string): void;
  onCancel(): void;
}

/**
 * Renaming a document, in the row the document already occupies.
 *
 * Committing on blur as well as on Enter is deliberate: the field appears under
 * the pointer, so clicking away is at least as likely as pressing a key, and
 * losing a rename to a stray click would be its own small betrayal. Escape is
 * the way out that keeps the old name.
 */
function RenameRow({ title, onCommit, onCancel }: RenameRowProps) {
  const [value, setValue] = useState(title);
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    ref.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;

    const next = value.trim();
    onCommit(next === '' ? title : next);
  };

  return (
    <input
      ref={ref}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          committedRef.current = true;
          onCancel();
        }
      }}
      aria-label={`Rename ${title}`}
      className="border-brand bg-surface text-primary text-body-sm focus-visible:outline-brand w-full rounded-md border px-2 py-1.5 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
    />
  );
}
