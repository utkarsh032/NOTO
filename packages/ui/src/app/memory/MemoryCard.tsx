import type { MemoryItem } from '@noto/types';

import { Badge } from '../../components/Badge';
import { Dropdown } from '../../components/Dropdown';
import { IconButton } from '../../components/IconButton';
import {
  CopyIcon,
  DocumentIcon,
  ExternalLinkIcon,
  MoreIcon,
  PinIcon,
  TrashIcon,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { formatBytes, relativeTime } from '../../utils/format';
import { MEMORY_KINDS } from './memory-kinds';

export interface MemoryCardProps {
  item: MemoryItem;
  onCopy(): void;
  onTogglePin(): void;
  onOpenInDocument(): void;
  onDelete(): void;
  className?: string;
}

/**
 * One captured thing.
 *
 * The content is the card — two lines of what was actually saved, because that
 * is what you recognise — and everything else (kind, source, when, tags) is a
 * quiet line underneath. Clipboard entries are set in the monospace face, since
 * what lands there is usually code or a path and proportional type makes both
 * harder to check.
 */
export function MemoryCard({
  item,
  onCopy,
  onTogglePin,
  onOpenInDocument,
  onDelete,
  className,
}: MemoryCardProps) {
  const kind = MEMORY_KINDS[item.kind];

  return (
    <article
      className={cn(
        'group/memory border-default bg-surface hover:border-strong flex flex-col rounded-xl border p-4 shadow-sm transition-all hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            kind.glyphClassName,
          )}
        >
          {kind.icon('h-[18px] w-[18px]')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-primary text-body-sm min-w-0 truncate font-semibold">
              {item.title}
            </h3>

            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton
                label={item.isPinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                size="sm"
                icon={<PinIcon className="h-4 w-4" />}
                isActive={item.isPinned}
                onClick={onTogglePin}
                className={cn(
                  !item.isPinned &&
                    'opacity-0 group-hover/memory:opacity-100 focus-visible:opacity-100',
                )}
              />

              <Dropdown
                label={`Actions for ${item.title}`}
                items={[
                  {
                    id: 'copy',
                    label: 'Copy content',
                    icon: <CopyIcon className="h-4 w-4" />,
                    onSelect: onCopy,
                  },
                  {
                    id: 'document',
                    label: 'Save as document',
                    icon: <DocumentIcon className="h-4 w-4" />,
                    onSelect: onOpenInDocument,
                  },
                  ...(item.url
                    ? [
                        {
                          id: 'open',
                          label: 'Open link',
                          icon: <ExternalLinkIcon className="h-4 w-4" />,
                          onSelect: () => window.open(item.url!, '_blank', 'noopener,noreferrer'),
                        },
                      ]
                    : []),
                  {
                    id: 'delete',
                    label: 'Remove from Memory',
                    icon: <TrashIcon className="h-4 w-4" />,
                    separated: true,
                    danger: true,
                    onSelect: onDelete,
                  },
                ]}
                trigger={(props) => (
                  <button
                    type="button"
                    {...props}
                    aria-label={`Actions for ${item.title}`}
                    className="text-tertiary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand flex h-7 w-7 items-center justify-center rounded-sm opacity-0 transition-colors group-hover/memory:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 aria-expanded:opacity-100"
                  >
                    <MoreIcon className="h-4 w-4" />
                  </button>
                )}
              />
            </div>
          </div>

          <p
            className={cn(
              'text-secondary mt-1 line-clamp-2 break-words',
              item.kind === 'clipboard' ? 'text-caption font-mono' : 'text-body-sm',
            )}
          >
            {item.content}
          </p>
        </div>
      </div>

      <div className="text-tertiary text-caption mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-12">
        <Badge tone={kind.tone}>{kind.label}</Badge>
        <span>{relativeTime(item.updatedAt)}</span>
        {item.source ? (
          <>
            <span aria-hidden="true">•</span>
            <span className="truncate">{item.source}</span>
          </>
        ) : null}
        {item.sizeBytes ? (
          <>
            <span aria-hidden="true">•</span>
            <span className="tabular-nums">{formatBytes(item.sizeBytes)}</span>
          </>
        ) : null}
        {item.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="bg-surface-tertiary text-tertiary rounded-full px-2 py-0.5">
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
