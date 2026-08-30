import { plainTextFromContent } from '@noto/core';
import type { NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconButton } from '../../components/IconButton';
import { showToast } from '../../components/toast-store';
import { CloseIcon } from '../../components/icons';
import { buildVersions } from '../../mock/versions';
import { cn } from '../../utils/cn';
import { formatDateTime, pluralise, relativeGroup, relativeTime } from '../../utils/format';
import { AIAssistantPanel } from '../overlays/AIAssistantPanel';
import { buildOutline, scrollToHeading } from './outline';

export type ContextTab = 'outline' | 'info' | 'versions' | 'ai';

export interface ContextPanelProps {
  document: NotoDocument;
  tab: ContextTab;
  onTab(tab: ContextTab): void;
  onClose(): void;
  /** Where the document lives, phrased for a person. */
  location: string;
}

const TABS: { id: ContextTab; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'info', label: 'Info' },
  { id: 'versions', label: 'Versions' },
  { id: 'ai', label: 'AI' },
];

/**
 * The panel beside the document: what is in it, what is known about it, what it
 * used to be, and the assistant.
 *
 * One panel with four tabs rather than four panels: at 320px there is only room
 * for one of them, and a writer who has opened the outline has not asked to
 * lose sight of the document to see it.
 */
export function ContextPanel({ document, tab, onTab, onClose, location }: ContextPanelProps) {
  return (
    <aside
      aria-label="Document details"
      className="noto-print-hidden border-default bg-surface w-context-panel hidden shrink-0 flex-col border-l lg:flex"
    >
      <div className="border-default flex items-center gap-1 border-b px-2 py-1.5">
        <div role="tablist" aria-label="Document details" className="flex min-w-0 flex-1 gap-0.5">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => onTab(entry.id)}
              className={cn(
                'text-body-sm focus-visible:outline-brand flex-1 rounded-md px-2 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                tab === entry.id
                  ? entry.id === 'ai'
                    ? 'bg-ai-soft text-ai'
                    : 'bg-brand-soft text-brand-strong'
                  : 'text-tertiary hover:text-primary hover:bg-surface-secondary',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <IconButton
          label="Close panel"
          size="sm"
          icon={<CloseIcon className="h-4 w-4" />}
          onClick={onClose}
        />
      </div>

      <div className="noto-scroll-y min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'outline' ? <OutlineTab document={document} /> : null}
        {tab === 'info' ? <InfoTab document={document} location={location} /> : null}
        {tab === 'versions' ? <VersionsTab document={document} /> : null}
        {tab === 'ai' ? (
          <AIAssistantPanel documentTitle={document.title} className="h-full" />
        ) : null}
      </div>
    </aside>
  );
}

function OutlineTab({ document }: { document: NotoDocument }) {
  const outline = useMemo(() => buildOutline(document.content), [document.content]);

  if (outline.length === 0) {
    return (
      <p className="text-tertiary text-body-sm">
        Headings you add appear here, as a way to move around a long document.
      </p>
    );
  }

  return (
    <nav aria-label="Document outline">
      <ul className="flex flex-col gap-0.5">
        {outline.map((entry) => (
          <li key={`${entry.index}-${entry.text}`}>
            <button
              type="button"
              onClick={() => scrollToHeading(entry.index)}
              className={cn(
                'text-body-sm text-secondary hover:bg-surface-secondary hover:text-primary focus-visible:outline-brand w-full truncate rounded-md py-1.5 pr-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                entry.level === 1 && 'pl-2 font-medium',
                entry.level === 2 && 'pl-5',
                entry.level >= 3 && 'text-caption pl-8',
              )}
            >
              {entry.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function InfoTab({ document, location }: { document: NotoDocument; location: string }) {
  const characters = useMemo(
    () => plainTextFromContent(document.content).length,
    [document.content],
  );

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Created', value: formatDateTime(document.createdAt) },
    { label: 'Updated', value: `${relativeTime(document.updatedAt)}` },
    { label: 'Location', value: location },
    {
      label: 'Status',
      value: (
        <Badge tone={document.status === 'archived' ? 'neutral' : 'brand'}>
          {document.status === 'archived' ? 'Archived' : 'Active'}
        </Badge>
      ),
    },
    { label: 'Words', value: pluralise(document.wordCount, 'word') },
    { label: 'Characters', value: characters.toLocaleString() },
  ];

  return (
    <div>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="text-tertiary text-caption shrink-0">{row.label}</dt>
            <dd className="text-primary text-body-sm min-w-0 text-right">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-default mt-5 border-t pt-4">
        <p className="text-tertiary text-caption mb-2">Tags</p>
        {document.tags.length === 0 ? (
          <p className="text-disabled text-body-sm">None yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {document.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VersionsTab({ document }: { document: NotoDocument }) {
  const versions = useMemo(
    () => buildVersions(document.id, document.wordCount),
    [document.id, document.wordCount],
  );

  const [restoring, setRestoring] = useState<string | null>(null);

  /* Grouped the way someone looks for a version: by when, not by number. */
  const groups = useMemo(() => {
    const map = new Map<string, typeof versions>();

    for (const version of versions) {
      const key = version.isCurrent ? 'Current' : relativeGroup(version.createdAt);
      map.set(key, [...(map.get(key) ?? []), version]);
    }

    return [...map.entries()];
  }, [versions]);

  return (
    <div>
      {/* Said once, at the top, rather than on every row. */}
      <p className="border-default bg-surface-secondary text-tertiary text-caption mb-4 rounded-lg border px-3 py-2">
        A preview. Noto keeps one recovery snapshot per document today; the full history arrives
        with sync.
      </p>

      {groups.map(([label, entries]) => (
        <section key={label} className="mb-4">
          <h3 className="text-tertiary text-caption px-1 pb-1 tracking-wide uppercase">{label}</h3>
          <ul className="flex flex-col gap-1">
            {entries.map((version) => (
              <li
                key={version.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  version.isCurrent ? 'border-brand bg-brand-soft' : 'border-default',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-primary text-body-sm font-medium">
                    {relativeTime(version.createdAt)}
                  </p>
                  <p className="text-tertiary text-caption tabular-nums">
                    {version.wordCount.toLocaleString()} w
                  </p>
                </div>
                <p className="text-tertiary text-caption mt-0.5">
                  {version.author}
                  {version.summary ? ` · ${version.summary}` : ''}
                </p>

                {version.isCurrent ? null : (
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => showToast('Previewing versions arrives with sync.')}
                      className="text-secondary hover:text-primary text-caption focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2"
                    >
                      Preview
                    </button>
                    <span className="text-disabled" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => showToast('Comparing versions arrives with sync.')}
                      className="text-secondary hover:text-primary text-caption focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2"
                    >
                      Compare
                    </button>
                    <span className="text-disabled" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => setRestoring(version.id)}
                      className="text-brand-strong hover:text-brand text-caption focus-visible:outline-brand rounded-sm font-medium focus-visible:outline-2"
                    >
                      Restore
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

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
        onConfirm={() =>
          showToast('Version history is not stored yet — the document is unchanged.', {
            tone: 'error',
          })
        }
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}
