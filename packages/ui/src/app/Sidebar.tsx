import { useUiStore } from '@noto/core';

import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';
import { useNotoData } from './data-context';

export function Sidebar() {
  const { workspace, documents, activeDocument, selectDocument, createDocument } = useNotoData();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

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
              <li key={document.id}>
                <button
                  type="button"
                  onClick={() => selectDocument(document.id)}
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-left transition-colors',
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
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
