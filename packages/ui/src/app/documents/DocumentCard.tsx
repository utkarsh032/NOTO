import type { NotoDocument } from '@noto/types';
import type { ReactNode } from 'react';

import { DocumentIcon, PinIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { pluralise, relativeTime } from '../../utils/format';

export interface DocumentCardProps {
  document: NotoDocument;
  location?: string;
  onOpen(): void;
  actions?: ReactNode;
  className?: string;
}

/**
 * One document, as a card, for the grid view and the Continue Writing rail.
 *
 * It shows the opening of the document rather than a description of it: three
 * lines of what you actually wrote are how you recognise a document you left
 * two days ago.
 */
export function DocumentCard({
  document,
  location,
  onOpen,
  actions,
  className,
}: DocumentCardProps) {
  return (
    <div
      className={cn(
        'group/card border-default bg-surface hover:border-strong relative flex flex-col rounded-lg border shadow-sm transition-all hover:shadow-md',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:outline-brand flex min-w-0 flex-1 flex-col rounded-lg p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="flex items-center gap-2.5">
          <span className="bg-brand-soft text-brand-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
            <DocumentIcon className="h-4 w-4" />
          </span>
          <span className="text-primary text-body-sm min-w-0 flex-1 truncate font-medium">
            {document.title || 'Untitled'}
          </span>
          {document.isFavorite ? (
            <PinIcon className="text-brand h-3.5 w-3.5 shrink-0" aria-label="Pinned" />
          ) : null}
        </span>

        {/* Two lines of the document itself, clamped. */}
        <span className="text-tertiary text-caption mt-3 line-clamp-2 min-h-8">
          {document.excerpt || 'Empty document'}
        </span>

        <span className="text-disabled text-caption mt-3 flex items-center gap-2">
          <span className="truncate">{relativeTime(document.updatedAt)}</span>
          <span aria-hidden="true">•</span>
          <span className="truncate">{location ?? pluralise(document.wordCount, 'word')}</span>
        </span>
      </button>

      {actions ? <div className="absolute top-2.5 right-2.5">{actions}</div> : null}
    </div>
  );
}
