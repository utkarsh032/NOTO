import { useUiStore } from '@noto/core';
import { useState } from 'react';

import notoIcon from '../assets/noto-icon.png';
import notoWordmark from '../assets/noto-wordmark.png';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';
import { useNotoData } from './data-context';

export function Sidebar() {
  const { workspace, documents, activeDocument, selectDocument, createDocument, deleteDocument } =
    useNotoData();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  /*
   * Deleting is confirmed inline rather than in a modal: the row itself asks,
   * and anything else in the list dismisses the question.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  /*
   * `h-12` plus the rule underneath comes to the same 49px as the main pane's
   * header, so the two read as one band across the window — and the mark holds
   * the same centre line whether the sidebar is open or collapsed, instead of
   * hopping when it is toggled.
   */
  const brandBar = 'border-border-subtle flex h-12 shrink-0 items-center border-b';

  /*
   * Collapsed, the sidebar keeps a rail rather than disappearing: the mark is
   * what tells the eye the panel is still there, and clicking it is the
   * shortest way back without hunting for the toggle in the header.
   */
  if (collapsed) {
    return (
      <aside className="bg-surface-sunken border-border-subtle flex h-full w-14 shrink-0 flex-col border-r">
        <div className={cn(brandBar, 'justify-center')}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="hover:bg-surface-raised focus-visible:outline-accent rounded-lg p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <img src={notoIcon} alt="" className="h-8 w-8" draggable={false} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-surface-sunken border-border-subtle flex h-full w-65 shrink-0 flex-col border-r">
      <header className={cn(brandBar, 'justify-between gap-2 px-4')}>
        {/* The wordmark carries the product name, so the alt text is the name
            itself rather than a description of the picture. */}
        <img src={notoWordmark} alt="Noto" className="h-6 w-auto" draggable={false} />
        <Button size="sm" variant="primary" onClick={() => void createDocument()}>
          New
        </Button>
      </header>

      {/* Displaced from the header by the wordmark, and no worse for it: read
          against the list it labels, it says which workspace these are. */}
      {workspace ? (
        <p className="text-subtle truncate px-4 pt-3 pb-1 text-xs font-medium">{workspace.name}</p>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Documents">
        {documents === undefined ? (
          <p className="text-subtle px-2 py-1 text-sm">Loading…</p>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Create your first document to get started."
            className="py-8"
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {documents.map((document) => (
              <li key={document.id} className="group/row relative">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingId(null);
                    selectDocument(document.id);
                  }}
                  className={cn(
                    'w-full rounded-md py-1.5 pr-9 pl-2 text-left transition-colors',
                    document.id === activeDocument?.id
                      ? 'bg-accent-subtle text-content'
                      : 'text-muted hover:bg-surface-raised hover:text-content',
                  )}
                >
                  <span className="block truncate text-sm font-medium">{document.title}</span>
                  <span className="text-subtle block truncate text-xs">
                    {document.excerpt || 'Empty document'}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingId(document.id)}
                    aria-label={`Move ${document.title} to trash`}
                    /*
                     * Hidden until the row is hovered, but always reachable by
                     * keyboard — focus-visible brings it back.
                     */
                    className="absolute top-1 right-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
