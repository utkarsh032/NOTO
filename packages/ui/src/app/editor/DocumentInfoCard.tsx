import type { NotoDocument } from '@noto/types';

import { Badge } from '../../components/Badge';
import { Dropdown } from '../../components/Dropdown';
import { IconButton } from '../../components/IconButton';
import {
  ArchiveIcon,
  ChevronDownIcon,
  CopyIcon,
  ExportIcon,
  PencilIcon,
  PinIcon,
  TrashIcon,
} from '../../components/icons';
import { formatDateTime, relativeTime } from '../../utils/format';
import type { DocumentOperations } from '../documents/use-document-operations';

/* -------------------------------------------------------------------------- */
/* Document Info                                                              */
/* -------------------------------------------------------------------------- */

interface DocumentInfoCardProps {
  document: NotoDocument;
  location: string;
  operations: DocumentOperations;
}

/**
 * The document's own facts, and the things you can do to the whole of it.
 *
 * The actions are a menu and one button. Deleting is the only one that cannot
 * be undone by repeating it, so it is the only one drawn in the danger tone and
 * the only one given a control of its own.
 */
export function DocumentInfoCard({ document, location, operations }: DocumentInfoCardProps) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Created', value: formatDateTime(document.createdAt) },
    { label: 'Updated', value: relativeTime(document.updatedAt) },
    { label: 'Location', value: location },
    {
      label: 'Status',
      value: (
        <Badge dot tone={document.status === 'archived' ? 'neutral' : 'brand'}>
          {document.status === 'archived' ? 'Archived' : 'In Progress'}
        </Badge>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="noto-document-info"
      className="border-default bg-surface shrink-0 rounded-xl border p-4"
    >
      <h2 id="noto-document-info" className="text-primary text-body font-semibold">
        Document Info
      </h2>

      <dl className="mt-3 flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-tertiary text-caption shrink-0">{row.label}</dt>
            <dd className="text-primary text-body-sm min-w-0 truncate text-right">{row.value}</dd>
          </div>
        ))}

        <div className="flex items-start justify-between gap-3">
          <dt className="text-tertiary text-caption shrink-0 pt-0.5">Tags</dt>
          <dd className="flex min-w-0 flex-wrap justify-end gap-1.5">
            {document.tags.length === 0 ? (
              <span className="text-disabled text-body-sm">None yet</span>
            ) : (
              document.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
            )}
          </dd>
        </div>
      </dl>

      <div className="border-default mt-4 flex items-center gap-2 border-t pt-3">
        <Dropdown
          align="left"
          label="Document actions"
          className="min-w-0 flex-1"
          items={[
            {
              id: 'rename',
              label: 'Rename',
              icon: <PencilIcon className="h-4 w-4" />,
              onSelect: () => operations.rename(document),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              icon: <CopyIcon className="h-4 w-4" />,
              onSelect: () => operations.duplicate(document),
            },
            {
              id: 'pin',
              label: document.isFavorite ? 'Unpin' : 'Pin',
              icon: <PinIcon className="h-4 w-4" />,
              onSelect: () => operations.togglePin(document),
            },
            {
              id: 'export',
              label: 'Export…',
              icon: <ExportIcon className="h-4 w-4" />,
              separated: true,
              onSelect: () => operations.exportDocument(document),
            },
            {
              id: 'archive',
              label: document.status === 'archived' ? 'Restore from archive' : 'Archive',
              icon: <ArchiveIcon className="h-4 w-4" />,
              onSelect: () => operations.archive(document),
            },
          ]}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              className="border-default text-secondary hover:bg-surface-secondary hover:text-primary hover:border-strong focus-visible:outline-brand text-body-sm flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              More actions
              <ChevronDownIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          )}
        />

        <IconButton
          label="Move to Trash"
          icon={<TrashIcon className="h-4 w-4" />}
          onClick={() => operations.remove(document)}
          className="text-danger hover:bg-danger/10 hover:text-danger border-default shrink-0 border"
        />
      </div>
    </section>
  );
}
