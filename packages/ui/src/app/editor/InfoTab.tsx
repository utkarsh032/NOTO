import { plainTextFromContent } from '@noto/core';
import type { NotoDocument } from '@noto/types';
import { useId, useMemo } from 'react';

import { Badge } from '../../components/Badge';
import { formatDateTime, pluralise, relativeTime } from '../../utils/format';
import { TagEditor } from '../documents/TagEditor';
import { useFolders } from '../folders/use-folders';

/* -------------------------------------------------------------------------- */
/* Info                                                                       */
/* -------------------------------------------------------------------------- */

export function InfoTab({ document, location }: { document: NotoDocument; location: string }) {
  const folders = useFolders();
  const folderFieldId = useId();

  const characters = useMemo(
    () => plainTextFromContent(document.content).length,
    [document.content],
  );

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
    { label: 'Words', value: pluralise(document.wordCount, 'word') },
    { label: 'Characters', value: characters.toLocaleString() },
  ];

  return (
    <div className="px-1">
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="text-tertiary text-caption shrink-0">{row.label}</dt>
            <dd className="text-primary text-body-sm min-w-0 text-right">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-default mt-5 border-t pt-4">
        <label htmlFor={folderFieldId} className="text-tertiary text-caption mb-2 block">
          Folder
        </label>
        <select
          id={folderFieldId}
          value={document.folderId ?? ''}
          onChange={(event) =>
            void folders.moveDocument(
              document.id,
              event.target.value === '' ? null : event.target.value,
            )
          }
          className="border-default bg-surface text-primary text-body-sm focus-visible:outline-brand w-full rounded-md border px-2 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-1"
        >
          <option value="">No folder</option>
          {folders.folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folders.pathOf(folder.id).join(' / ')}
            </option>
          ))}
        </select>
      </div>

      <div className="border-default mt-5 border-t pt-4">
        <p className="text-tertiary text-caption mb-2">Tags</p>
        <TagEditor document={document} />
      </div>
    </div>
  );
}
