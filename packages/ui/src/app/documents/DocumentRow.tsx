import type { NotoDocument } from '@noto/types';
import type { ReactNode } from 'react';

import { DocumentIcon, PinIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { timestampLabel } from '../../utils/format';

export interface DocumentRowProps {
  document: NotoDocument;
  /** Where it lives — "Work / Planning". Falls back to the workspace name. */
  location?: string;
  onOpen(): void;
  /** The row's overflow menu. Rendered outside the button, so it stays clickable. */
  actions?: ReactNode;
  isActive?: boolean;
  className?: string;
}

/**
 * One document, as a row.
 *
 * The whole row is the target — a title that is a link inside a row that is not
 * makes people aim — and the menu sits outside that button rather than inside
 * it, because a button cannot contain another one.
 */
export function DocumentRow({
  document,
  location,
  onOpen,
  actions,
  isActive = false,
  className,
}: DocumentRowProps) {
  return (
    <div
      className={cn(
        'group/doc hover:bg-surface-secondary relative flex items-center rounded-lg transition-colors',
        isActive && 'bg-brand-soft',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:outline-brand flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            isActive ? 'bg-brand-muted text-brand-strong' : 'bg-brand-soft text-brand-hover',
          )}
        >
          <DocumentIcon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-primary text-body-sm truncate font-medium">
              {document.title || 'Untitled'}
            </span>
            {document.isFavorite ? (
              <PinIcon className="text-brand h-3.5 w-3.5 shrink-0" aria-label="Pinned" />
            ) : null}
          </span>
          <span className="text-tertiary text-caption block truncate">
            {location ?? document.excerpt ?? ''}
          </span>
        </span>

        <span className="text-tertiary text-caption hidden shrink-0 sm:block">
          {timestampLabel(document.updatedAt)}
        </span>
      </button>

      {actions ? <div className="shrink-0 pr-1.5 pl-0.5">{actions}</div> : null}
    </div>
  );
}
