import { DocumentIcon } from '../../components/icons';
import { cn } from '../../utils/cn';
import { relativeTime } from '../../utils/format';
import { MEMORY_KINDS } from '../memory/memory-kinds';
import { Highlight } from './Highlight';
import type { SearchHit } from './use-search';

export interface SearchResultRowProps {
  hit: SearchHit;
  query: string;
  onOpen(): void;
  /** Actions for this result — copy, open link. */
  actions?: React.ReactNode;
  /** Draws the row as one of the top matches: brand-tinted glyph, thicker border. */
  emphasised?: boolean;
}

/**
 * One search result.
 *
 * The matched text is the point of the row, so it gets a snippet centred on the
 * first hit rather than the opening of the document — finding "concatMap" and
 * being shown the first line of a file you have not opened in a week is not an
 * answer.
 */
export function SearchResultRow({
  hit,
  query,
  onOpen,
  actions,
  emphasised = false,
}: SearchResultRowProps) {
  const kind = hit.kind === 'document' ? null : MEMORY_KINDS[hit.kind];

  return (
    <div
      className={cn(
        'group/hit hover:border-strong flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
        emphasised ? 'border-brand-subtle bg-brand-soft/40' : 'border-default bg-surface',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:outline-brand flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-2"
      >
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            kind ? kind.glyphClassName : 'bg-brand-soft text-brand-hover',
          )}
        >
          {kind ? kind.icon('h-4 w-4') : <DocumentIcon className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-primary text-body-sm block truncate font-semibold">
            <Highlight text={hit.title} query={query} />
          </span>

          <span className="text-secondary text-body-sm mt-0.5 line-clamp-2 block break-words">
            <Highlight text={hit.body} query={query} snippet />
          </span>

          <span className="text-tertiary text-caption mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{kind ? kind.label : 'Document'}</span>
            <span aria-hidden="true">•</span>
            <span className="truncate">{hit.location}</span>
            <span aria-hidden="true">•</span>
            <span>{relativeTime(hit.updatedAt)}</span>
            {hit.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="bg-surface-tertiary rounded-full px-2 py-0.5">
                #{tag}
              </span>
            ))}
          </span>
        </span>
      </button>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
