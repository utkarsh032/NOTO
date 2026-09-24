import type { DocumentVersionRecord, NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDateTime, relativeGroup, relativeTime } from '../../utils/format';
import { emitAppCommand } from '../app-commands';
import { VersionCompareDialog, VersionPreviewDialog } from '../versions/VersionDialogs';
import { versionOriginLabel } from '../versions/version-labels';
import { useDocumentVersions } from '../versions/use-document-versions';

/* -------------------------------------------------------------------------- */
/* Versions                                                                   */
/* -------------------------------------------------------------------------- */

export function VersionsTab({ document }: { document: NotoDocument }) {
  const { versions, loading } = useDocumentVersions(document.id);

  const [previewing, setPreviewing] = useState<DocumentVersionRecord | null>(null);
  const [comparing, setComparing] = useState<DocumentVersionRecord | null>(null);
  const [restoring, setRestoring] = useState<DocumentVersionRecord | null>(null);

  /* Grouped the way someone looks for a version: by when, not by number. */
  const groups = useMemo(() => {
    const map = new Map<string, DocumentVersionRecord[]>();

    for (const version of versions) {
      const key = relativeGroup(version.createdAt);
      map.set(key, [...(map.get(key) ?? []), version]);
    }

    return [...map.entries()];
  }, [versions]);

  const linkClass =
    'text-secondary hover:text-primary text-caption focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2';

  return (
    <div>
      {/* The document as it is now, always first. */}
      <section className="mb-4">
        <h3 className="text-tertiary text-caption px-1 pb-1 tracking-wide uppercase">Current</h3>
        <div className="border-brand bg-brand-soft rounded-lg border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-primary text-body-sm font-medium">
              Edited {relativeTime(document.updatedAt)}
            </p>
            <p className="text-tertiary text-caption tabular-nums">
              {document.wordCount.toLocaleString()} w
            </p>
          </div>
        </div>
      </section>

      {!loading && versions.length === 0 ? (
        <p className="border-default text-tertiary text-caption rounded-lg border border-dashed px-3 py-3">
          No earlier versions yet. Noto keeps one when you change a document that has been left
          alone for ten minutes, every time you press Save, and before any restore.
        </p>
      ) : null}

      {groups.map(([label, entries]) => (
        <section key={label} className="mb-4">
          <h3 className="text-tertiary text-caption px-1 pb-1 tracking-wide uppercase">{label}</h3>
          <ul className="flex flex-col gap-1" aria-label={`Versions from ${label}`}>
            {entries.map((version) => (
              <li key={version.id} className="border-default rounded-lg border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="text-primary text-body-sm font-medium"
                    title={formatDateTime(version.createdAt)}
                  >
                    {relativeTime(version.createdAt)}
                  </p>
                  <p className="text-tertiary text-caption tabular-nums">
                    {version.wordCount.toLocaleString()} w
                  </p>
                </div>
                <p className="text-tertiary text-caption mt-0.5">
                  {versionOriginLabel(version)}
                  {version.summary ? ` · ${version.summary}` : ''}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewing(version)}
                    className={linkClass}
                  >
                    Preview
                  </button>
                  <span className="text-disabled" aria-hidden="true">
                    ·
                  </span>
                  <button type="button" onClick={() => setComparing(version)} className={linkClass}>
                    Compare
                  </button>
                  <span className="text-disabled" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => setRestoring(version)}
                    className="text-brand-strong hover:text-brand text-caption focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2"
                  >
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <VersionPreviewDialog
        version={previewing}
        onClose={() => setPreviewing(null)}
        onRestore={(version) => {
          setPreviewing(null);
          setRestoring(version);
        }}
      />

      <VersionCompareDialog
        version={comparing}
        document={document}
        onClose={() => setComparing(null)}
      />

      {/* Restoring replaces what is on screen, so it is always confirmed. */}
      <ConfirmDialog
        open={restoring !== null}
        title="Restore this version?"
        confirmLabel="Restore"
        description={
          <>
            <p>The document will be replaced with the version you picked.</p>
            <p className="mt-2">
              Nothing is lost: the current text becomes a version of its own, and you can restore it
              back.
            </p>
          </>
        }
        onConfirm={() => {
          // The editor restores it: it holds the unsaved keystrokes that have
          // to be written, and kept, before the old text replaces them.
          if (restoring) emitAppCommand('document.restoreVersion', restoring.id);
        }}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}
