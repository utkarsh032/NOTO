import { diffLines, diffStats, plainTextFromContent } from '@noto/core';
import type { DocumentVersionRecord, NotoDocument } from '@noto/types';
import { useMemo } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/format';
import { versionOriginLabel } from './version-labels';

/** The text of an old version, read-only, with a way to bring it back. */
export function VersionPreviewDialog({
  version,
  onClose,
  onRestore,
}: {
  version: DocumentVersionRecord | null;
  onClose(): void;
  onRestore(version: DocumentVersionRecord): void;
}) {
  const text = useMemo(() => (version ? plainTextFromContent(version.content) : ''), [version]);

  return (
    <Dialog
      open={version !== null}
      onClose={onClose}
      title={version ? version.title || 'Untitled' : ''}
      description={
        version
          ? `${versionOriginLabel(version)} · ${formatDateTime(version.createdAt)}`
          : undefined
      }
      size="lg"
      footer={
        version ? (
          <Button variant="primary" onClick={() => onRestore(version)}>
            Restore this version
          </Button>
        ) : null
      }
    >
      <div
        aria-label="Version text"
        className="text-primary text-body bg-surface-secondary max-h-[60vh] overflow-auto rounded-lg p-4 leading-relaxed whitespace-pre-wrap"
      >
        {text || 'This version has no text.'}
      </div>
    </Dialog>
  );
}

/** An old version beside the document as it is now, line by line. */
export function VersionCompareDialog({
  version,
  document,
  onClose,
}: {
  version: DocumentVersionRecord | null;
  document: NotoDocument;
  onClose(): void;
}) {
  const lines = useMemo(
    () =>
      version
        ? diffLines(plainTextFromContent(version.content), plainTextFromContent(document.content))
        : [],
    [version, document.content],
  );
  const stats = diffStats(lines);

  return (
    <Dialog
      open={version !== null}
      onClose={onClose}
      title="Compare with now"
      description={
        version
          ? `${formatDateTime(version.createdAt)} → now · ${stats.added} added, ${stats.removed} removed`
          : undefined
      }
      size="lg"
    >
      <ol
        aria-label="Changes"
        className="text-body-sm bg-surface-secondary max-h-[60vh] overflow-auto rounded-lg py-2 font-mono leading-relaxed"
      >
        {lines.map((line, index) => (
          <li
            key={index}
            className={cn(
              'px-3 whitespace-pre-wrap',
              line.kind === 'added' && 'bg-success/10 text-success',
              line.kind === 'removed' && 'bg-danger/10 text-danger line-through',
              line.kind === 'same' && 'text-secondary',
            )}
          >
            <span aria-hidden="true" className="mr-2 inline-block w-3 select-none">
              {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
            </span>
            <span className="sr-only">
              {line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}
            </span>
            {line.text || ' '}
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
