import { plainTextFromContent } from '@noto/core';
import type { NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dropdown } from '../../components/Dropdown';
import { IconButton } from '../../components/IconButton';
import { SearchInput } from '../../components/SearchInput';
import { showToast } from '../../components/toast-store';
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExportIcon,
  FilterIcon,
  PencilIcon,
  PinIcon,
  SparklesIcon,
  TrashIcon,
} from '../../components/icons';
import { buildVersions } from '../../mock/versions';
import { cn } from '../../utils/cn';
import { formatDateTime, pluralise, relativeGroup, relativeTime } from '../../utils/format';
import {
  type DocumentOperations,
  useDocumentOperations,
} from '../documents/use-document-operations';
import { AIAssistantPanel } from '../overlays/AIAssistantPanel';
import {
  type OutlineNode,
  buildOutline,
  buildOutlineTree,
  scrollToHeading,
  useActiveHeading,
} from './outline';

export type ContextTab = 'outline' | 'info' | 'versions' | 'ai';

export interface ContextPanelProps {
  document: NotoDocument;
  tab: ContextTab;
  onTab(tab: ContextTab): void;
  /** Where the document lives, phrased for a person. */
  location: string;
}

const TABS: { id: ContextTab; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'info', label: 'Info' },
  { id: 'versions', label: 'Versions' },
  { id: 'ai', label: 'AI Assistant' },
];

/**
 * The column beside the document: what is in it, what is known about it, what
 * it used to be, and the assistant.
 *
 * Two cards rather than one. The upper card holds views a writer chooses
 * between — outline, history, assistant — because only one of them is usable at
 * 320px. The lower card holds the document's own facts, which stay true
 * whichever view is open, so they stay on screen instead of having to be
 * navigated back to.
 */
export function ContextPanel({ document, tab, onTab, location }: ContextPanelProps) {
  const operations = useDocumentOperations();

  return (
    <aside
      aria-label="Document details"
      className="noto-print-hidden border-default bg-background w-context-panel hidden shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex"
    >
      <section className="border-default bg-surface flex min-h-0 flex-1 flex-col rounded-xl border">
        <div
          role="tablist"
          aria-label="Document details"
          className="border-default flex shrink-0 items-center gap-3 border-b px-4"
        >
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => onTab(entry.id)}
              className={cn(
                'text-body-sm focus-visible:outline-brand -mb-px flex shrink-0 items-center gap-1 border-b-2 py-3 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                tab === entry.id
                  ? entry.id === 'ai'
                    ? 'border-ai text-ai'
                    : 'border-brand text-brand-strong'
                  : 'text-tertiary hover:text-primary border-transparent',
              )}
            >
              {entry.label}
              {/* The assistant is the one thing here Noto writes rather than
                  reads, and the mark is how that is said everywhere in Noto. */}
              {entry.id === 'ai' ? (
                <SparklesIcon
                  className={cn('h-3.5 w-3.5', tab === 'ai' ? 'text-ai' : 'text-ai/60')}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="noto-scroll-y min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'outline' ? <OutlineTab document={document} /> : null}
          {tab === 'info' ? <InfoTab document={document} location={location} /> : null}
          {tab === 'versions' ? <VersionsTab document={document} /> : null}
          {tab === 'ai' ? (
            <AIAssistantPanel documentTitle={document.title} className="h-full" />
          ) : null}
        </div>
      </section>

      {/* The facts move up into the card when Info is the view being read,
          rather than being printed twice on the same screen. */}
      {tab === 'info' ? null : (
        <DocumentInfoCard document={document} location={location} operations={operations} />
      )}

      {operations.dialogs}
    </aside>
  );
}

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
function DocumentInfoCard({ document, location, operations }: DocumentInfoCardProps) {
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

/* -------------------------------------------------------------------------- */
/* Outline                                                                    */
/* -------------------------------------------------------------------------- */

/** How deep the outline goes. Anything deeper is folded out of the tree. */
const DEPTHS = [
  { id: '3', label: 'All levels' },
  { id: '2', label: 'Heading 1 and 2' },
  { id: '1', label: 'Heading 1 only' },
];

function OutlineTab({ document }: { document: NotoDocument }) {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState(3);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());

  const active = useActiveHeading(document.id);

  const entries = useMemo(() => buildOutline(document.content), [document.content]);

  /*
   * Searching flattens the tree deliberately. A match three levels down is
   * still a match, and hiding it behind a parent that does not match is the
   * one thing a search in a panel this size must not do.
   */
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle === '' ? null : entries.filter((entry) => entry.text.toLowerCase().includes(needle)),
    [entries, needle],
  );

  const tree = useMemo(
    () => buildOutlineTree(entries.filter((entry) => entry.level <= depth)),
    [entries, depth],
  );

  const toggle = (index: number) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 px-1">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label="Search in document"
          inputSize="sm"
          className="min-w-0 flex-1"
        />
        <Dropdown
          label="Outline depth"
          items={DEPTHS.map((option) => ({
            id: option.id,
            label: option.label,
            trailing: String(depth) === option.id ? '✓' : undefined,
            onSelect: () => setDepth(Number(option.id)),
          }))}
          trigger={(triggerProps) => (
            <IconButton
              {...triggerProps}
              label="Outline depth"
              variant="surface"
              icon={<FilterIcon className="h-4 w-4" />}
              isActive={depth < 3}
            />
          )}
        />
      </div>

      {entries.length === 0 ? (
        <p className="text-tertiary text-body-sm px-1 pt-4">
          Headings you add appear here, as a way to move around a long document.
        </p>
      ) : (
        <nav aria-label="Document outline" className="mt-3 min-w-0">
          {/* The title is the root of the map, not an entry in it: it is what
              the headings below are headings of. */}
          <p className="text-primary text-body-sm flex items-center gap-1 truncate px-1 pb-1 font-semibold">
            <ChevronDownIcon className="text-tertiary h-4 w-4 shrink-0" aria-hidden="true" />
            {document.title || 'Untitled'}
          </p>

          {matches ? (
            matches.length === 0 ? (
              <p className="text-tertiary text-body-sm px-2 py-2">No heading matches “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {matches.map((entry) => (
                  <li key={entry.index}>
                    <OutlineRow entry={entry} depth={0} isActive={entry.index === active} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <OutlineBranch
              nodes={tree}
              depth={0}
              active={active}
              collapsed={collapsed}
              onToggle={toggle}
            />
          )}
        </nav>
      )}
    </div>
  );
}

interface OutlineBranchProps {
  nodes: OutlineNode[];
  depth: number;
  active: number;
  collapsed: ReadonlySet<number>;
  onToggle(index: number): void;
}

function OutlineBranch({ nodes, depth, active, collapsed, onToggle }: OutlineBranchProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const isCollapsed = collapsed.has(node.index);

        return (
          <li key={node.index}>
            <OutlineRow
              entry={node}
              depth={depth}
              isActive={node.index === active}
              hasChildren={node.children.length > 0}
              isCollapsed={isCollapsed}
              onToggle={() => onToggle(node.index)}
            />

            {node.children.length > 0 && !isCollapsed ? (
              <OutlineBranch
                nodes={node.children}
                depth={depth + 1}
                active={active}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface OutlineRowProps {
  entry: { index: number; text: string };
  depth: number;
  isActive: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggle?(): void;
}

function OutlineRow({
  entry,
  depth,
  isActive,
  hasChildren = false,
  isCollapsed = false,
  onToggle,
}: OutlineRowProps) {
  return (
    <div
      className={cn(
        'group/row flex items-center rounded-md transition-colors',
        isActive ? 'bg-brand-soft' : 'hover:bg-surface-secondary',
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {/* The twisty is a control of its own, so folding a section does not also
          scroll the document to it. */}
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? `Expand ${entry.text}` : `Collapse ${entry.text}`}
          aria-expanded={!isCollapsed}
          className="text-tertiary hover:text-primary focus-visible:outline-brand flex h-7 w-5 shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-1"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={() => scrollToHeading(entry.index)}
        aria-current={isActive ? 'true' : undefined}
        title={entry.text}
        className={cn(
          'text-body-sm focus-visible:outline-brand min-w-0 flex-1 truncate py-1.5 pr-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
          isActive
            ? 'text-brand-strong font-medium'
            : 'text-secondary group-hover/row:text-primary',
        )}
      >
        {entry.text}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Info                                                                       */
/* -------------------------------------------------------------------------- */

function InfoTab({ document, location }: { document: NotoDocument; location: string }) {
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

/* -------------------------------------------------------------------------- */
/* Versions                                                                   */
/* -------------------------------------------------------------------------- */

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
