import type { Id, NotoDocument } from '@noto/types';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { DocumentIcon, PencilIcon, PinIcon, TrashIcon } from '../components/icons';
import { cn } from '../utils/cn';

export interface SidebarDocumentListProps {
  documents: NotoDocument[];
  activeId: Id | null;
  /** The accessible name of the list — "All documents", "Pinned". */
  label: string;
  onOpen(id: Id): void;
  onRename(id: Id, title: string): void;
  onDelete(id: Id): void;
  /** Draws a pin on every row. Used by the Pinned section. */
  showPin?: boolean;
}

/**
 * The documents in the sidebar.
 *
 * Renaming happens in the row and deleting is confirmed in the row, because
 * both are about one document and a dialog about one row is a dialog that
 * covers the list you were comparing it against.
 */
export function SidebarDocumentList({
  documents,
  activeId,
  label,
  onOpen,
  onRename,
  onDelete,
  showPin = false,
}: SidebarDocumentListProps) {
  const [confirmingId, setConfirmingId] = useState<Id | null>(null);
  const [renamingId, setRenamingId] = useState<Id | null>(null);

  return (
    <ul className="flex flex-col gap-0.5" aria-label={label}>
      {documents.map((document) => {
        const isActive = document.id === activeId;

        if (renamingId === document.id) {
          return (
            <li key={document.id}>
              <RenameRow
                title={document.title}
                onCommit={(title) => {
                  setRenamingId(null);
                  if (title !== document.title) onRename(document.id, title);
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
                onOpen(document.id);
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
                className={cn('mt-0.5 h-4 w-4 shrink-0', isActive ? 'text-brand' : 'text-disabled')}
              />
              <span className="min-w-0 flex-1">
                <span className="text-body-sm flex items-center gap-1.5 font-medium">
                  <span className="min-w-0 truncate">{document.title}</span>
                  {showPin ? <PinIcon className="text-brand h-3 w-3 shrink-0" /> : null}
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
                    onDelete(document.id);
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
