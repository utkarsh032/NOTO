import { useUiStore } from '@noto/core';
import { useState } from 'react';

import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';
import { useNotoData } from './data-context';

export function Sidebar() {
  const { workspace, documents, activeDocument, selectDocument, createDocument, deleteDocument } =
    useNotoData();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  /*
   * Deleting is confirmed inline rather than in a modal: the row itself asks,
   * and anything else in the list dismisses the question.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (collapsed) return null;

  return (
    <aside className="bg-surface-sunken border-border-subtle flex h-full w-65 shrink-0 flex-col border-r">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="text-content truncate text-sm font-semibold">
          {workspace?.name ?? 'Noto'}
        </span>
        <Button size="sm" variant="primary" onClick={() => void createDocument()}>
          New
        </Button>
      </header>

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
