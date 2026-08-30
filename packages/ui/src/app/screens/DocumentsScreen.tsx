import type { NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dropdown } from '../../components/Dropdown';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { LoadingState } from '../../components/LoadingState';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Tabs } from '../../components/Tabs';
import { showToast } from '../../components/toast-store';
import {
  ChevronDownIcon,
  DocumentIcon,
  ExportIcon,
  FilterIcon,
  FolderIcon,
  GridIcon,
  ImportIcon,
  ListIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from '../../components/icons';
import { EmptyPageIllustration } from '../../components/illustrations';
import { cn } from '../../utils/cn';
import { formatBytes, timestampLabel } from '../../utils/format';
import { PageContainer } from '../PageContainer';
import { DocumentCard } from '../documents/DocumentCard';
import { DocumentMenu } from '../documents/DocumentMenu';
import { useDocumentOperations } from '../documents/use-document-operations';
import { ExportDialog } from '../overlays/ExportDialog';
import { ImportDialog } from '../overlays/ImportDialog';
import { bundleDocuments } from '../export';
import { useNotoData } from '../data-context';
import { useNotoActions } from '../use-noto-actions';

type DocumentsTab = 'all' | 'documents' | 'folders' | 'recent' | 'starred' | 'trash';
type SortKey = 'updated' | 'created' | 'title';

const SORT_LABEL: Record<SortKey, string> = {
  updated: 'Last modified',
  created: 'Date created',
  title: 'Name',
};

/** A rough size for a document, from the text it holds. */
function sizeOf(document: NotoDocument): number {
  return document.excerpt.length + JSON.stringify(document.content).length;
}

/**
 * Documents.
 *
 * The screen for finding a document you know exists, as opposed to Home, which
 * is for the ones you were just in. It is a table by default because that is
 * what comparing forty things by date wants — the grid is there for when you
 * are looking for something you would recognise by its opening line.
 */
export function DocumentsScreen() {
  const { documents, trashedDocuments, workspace, restoreDocument, purgeDocument } = useNotoData();
  const actions = useNotoActions();
  const operations = useDocumentOperations();

  const [tab, setTab] = useState<DocumentsTab>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sort, setSort] = useState<SortKey>('updated');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [purging, setPurging] = useState<NotoDocument | null>(null);

  const starred = useMemo(
    () => (documents ?? []).filter((document) => document.isFavorite),
    [documents],
  );

  const rows = useMemo(() => {
    const source = tab === 'trash' ? (trashedDocuments ?? []) : (documents ?? []);

    const filtered = source.filter((document) => {
      if (tab === 'starred' && !document.isFavorite) return false;
      if (query.trim() === '') return true;

      const needle = query.trim().toLowerCase();
      return (
        document.title.toLowerCase().includes(needle) ||
        document.excerpt.toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered].sort((left, right) => {
      if (sort === 'title') return left.title.localeCompare(right.title);
      if (sort === 'created') return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });

    /* Recent is the same list, cut to the handful that means "recent". */
    return tab === 'recent' ? sorted.slice(0, 10) : sorted;
  }, [tab, documents, trashedDocuments, query, sort]);

  const isLoading = documents === undefined;
  const isTrash = tab === 'trash';

  const menuFor = (document: NotoDocument) => (
    <DocumentMenu
      revealOnHover
      document={document}
      onOpen={() => operations.open(document.id)}
      onRename={() => operations.rename(document)}
      onDuplicate={() => operations.duplicate(document)}
      onTogglePin={() => operations.togglePin(document)}
      onArchive={() => operations.archive(document)}
      onExport={() => operations.exportDocument(document)}
      onDelete={() => operations.remove(document)}
    />
  );

  return (
    <PageContainer
      title="Documents"
      subtitle="Browse, manage and organize all your documents."
      actions={
        <>
          <Button
            variant="secondary"
            leading={<ImportIcon className="h-5 w-5" />}
            onClick={() => setImporting(true)}
          >
            Import
          </Button>
          {/* Named for what it does. A bare "Export" beside a list is a
              question — which one? — and the row menu already answers it for a
              single document. */}
          <Button
            variant="secondary"
            leading={<ExportIcon className="h-5 w-5" />}
            disabled={rows.length === 0}
            onClick={() => setExportingAll(true)}
          >
            Export all
          </Button>
          <Button
            variant="primary"
            leading={<PlusIcon className="h-5 w-5" />}
            onClick={() => void actions.newDocument()}
          >
            New Document
          </Button>
        </>
      }
      tabs={
        <Tabs
          label="Filter documents"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All', count: documents?.length },
            { value: 'documents', label: 'Documents', count: documents?.length },
            { value: 'folders', label: 'Folders' },
            { value: 'recent', label: 'Recent' },
            { value: 'starred', label: 'Starred', count: starred.length },
            { value: 'trash', label: 'Trash', count: trashedDocuments?.length },
          ]}
        />
      }
      asideLabel="Document filters"
      aside={
        <DocumentFilters
          documents={documents ?? []}
          workspaceName={workspace?.name ?? 'Workspace'}
        />
      }
    >
      {/* The controls that act on the list, above the list they act on. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          label="Filter documents by name"
          placeholder="Filter by name…"
          inputSize="sm"
          className="w-full max-w-xs"
        />

        <Dropdown
          label="Sort"
          align="left"
          items={(Object.keys(SORT_LABEL) as SortKey[]).map((key) => ({
            id: key,
            label: SORT_LABEL[key],
            trailing: sort === key ? '✓' : undefined,
            onSelect: () => setSort(key),
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="border-default bg-surface text-secondary hover:border-strong hover:text-primary text-body-sm focus-visible:outline-brand flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-medium transition-colors focus-visible:outline-2"
            >
              <SortIcon className="h-4 w-4" />
              {SORT_LABEL[sort]}
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          )}
        />

        <span className="ml-auto flex items-center gap-2">
          <IconButton
            label="Filters"
            variant="surface"
            size="sm"
            icon={<FilterIcon className="h-4 w-4" />}
            onClick={() => showToast('Filters are in the panel on the right.')}
            className="xl:hidden"
          />
          <SegmentedControl
            size="sm"
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List view', icon: <ListIcon className="h-4 w-4" /> },
              { value: 'grid', label: 'Grid view', icon: <GridIcon className="h-4 w-4" /> },
            ]}
          />
        </span>
      </div>

      {tab === 'folders' ? (
        <EmptyState
          title="Folders are coming"
          description="Documents live in your workspace today. Folders arrive with the next release, and everything here will move into them."
          illustration={<FolderIcon className="text-disabled h-12 w-12" />}
          className="border-default bg-surface rounded-xl border py-16"
        />
      ) : isLoading ? (
        <LoadingState
          label="Loading documents"
          rows={6}
          variant={view === 'grid' ? 'card' : 'list'}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            isTrash ? 'Trash is empty' : query ? 'Nothing matches that' : 'No documents here yet'
          }
          description={
            isTrash
              ? 'Documents you delete stay here until you empty them.'
              : query
                ? 'Try a shorter search, or clear it to see everything.'
                : 'Create a document and it will appear in this list.'
          }
          illustration={<EmptyPageIllustration />}
          action={
            isTrash || query ? undefined : (
              <Button
                variant="primary"
                leading={<PlusIcon className="h-5 w-5" />}
                onClick={() => void actions.newDocument()}
              >
                New Document
              </Button>
            )
          }
          className="border-default bg-surface rounded-xl border py-16"
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              location={workspace?.name}
              onOpen={() => operations.open(document.id)}
              actions={isTrash ? undefined : menuFor(document)}
            />
          ))}
        </div>
      ) : (
        <div className="border-default bg-surface overflow-hidden rounded-xl border shadow-sm">
          {/* A table, marked up as one: the columns mean something, and a
              screen reader should be able to say which. */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-default bg-surface-secondary text-tertiary text-caption border-b text-left">
                <th scope="col" className="w-[40%] px-4 py-2.5 font-medium">
                  Name
                </th>
                <th scope="col" className="hidden w-[12%] px-4 py-2.5 font-medium sm:table-cell">
                  Type
                </th>
                <th scope="col" className="hidden w-[16%] px-4 py-2.5 font-medium md:table-cell">
                  Folder
                </th>
                <th scope="col" className="w-[18%] px-4 py-2.5 font-medium">
                  Modified
                </th>
                <th scope="col" className="hidden w-[10%] px-4 py-2.5 font-medium lg:table-cell">
                  Size
                </th>
                <th scope="col" className="w-14 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => (
                <tr
                  key={document.id}
                  className="group/doc border-default hover:bg-surface-secondary border-b transition-colors last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        isTrash
                          ? showToast('Restore this document to open it.')
                          : operations.open(document.id)
                      }
                      className="focus-visible:outline-brand flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left focus-visible:outline-2"
                    >
                      <DocumentIcon className="text-brand-hover h-4 w-4 shrink-0" />
                      <span className="text-primary text-body-sm min-w-0 flex-1 truncate font-medium">
                        {document.title || 'Untitled'}
                      </span>
                      {document.isFavorite ? <Badge tone="brand">Pinned</Badge> : null}
                    </button>
                  </td>
                  <td className="text-tertiary text-caption hidden px-4 py-2.5 sm:table-cell">
                    Document
                  </td>
                  <td className="text-tertiary text-caption hidden truncate px-4 py-2.5 md:table-cell">
                    {workspace?.name ?? '—'}
                  </td>
                  <td className="text-tertiary text-caption px-4 py-2.5">
                    {timestampLabel(isTrash ? (document.deletedAt ?? '') : document.updatedAt)}
                  </td>
                  <td className="text-tertiary text-caption hidden px-4 py-2.5 tabular-nums lg:table-cell">
                    {formatBytes(sizeOf(document))}
                  </td>
                  <td className="px-2 py-2.5">
                    {isTrash ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void restoreDocument(document.id);
                            showToast(`Restored “${document.title || 'Untitled'}”`, {
                              tone: 'success',
                            });
                          }}
                        >
                          Restore
                        </Button>
                        <IconButton
                          label={`Delete ${document.title || 'Untitled'} permanently`}
                          size="sm"
                          icon={<TrashIcon className="h-4 w-4" />}
                          onClick={() => setPurging(document)}
                          className="hover:text-danger"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-end">{menuFor(document)}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExportDialog
        open={exportingAll}
        document={exportingAll ? bundleDocuments(rows, workspace?.name ?? 'Noto documents') : null}
        onClose={() => setExportingAll(false)}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImport={async (imported) => {
          for (const document of imported) {
            await actions.importDocument(document);
          }
        }}
      />

      <ConfirmDialog
        open={purging !== null}
        title="Delete permanently?"
        destructive
        confirmLabel="Delete permanently"
        description={
          <>
            <p>“{purging?.title || 'Untitled'}” will be removed from this device for good.</p>
            <p className="mt-2">This cannot be undone.</p>
          </>
        }
        onConfirm={() => {
          if (purging) void purgeDocument(purging.id);
        }}
        onClose={() => setPurging(null)}
      />

      {operations.dialogs}
    </PageContainer>
  );
}

interface DocumentFiltersProps {
  documents: NotoDocument[];
  workspaceName: string;
}

/**
 * The filter panel.
 *
 * It reports what is actually there — the tags people have used, the one place
 * documents currently live — rather than offering a taxonomy the workspace does
 * not have yet.
 */
function DocumentFilters({ documents, workspaceName }: DocumentFiltersProps) {
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const document of documents) {
      for (const tag of document.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [documents]);

  return (
    <div className="flex flex-col gap-6">
      <FilterGroup title="File type">
        <FilterRow
          label="Documents"
          count={documents.length}
          icon={<DocumentIcon className="h-4 w-4" />}
        />
        <FilterRow label="Folders" count={0} icon={<FolderIcon className="h-4 w-4" />} />
      </FilterGroup>

      <FilterGroup title="Folders">
        <FilterRow
          label={workspaceName}
          count={documents.length}
          icon={<FolderIcon className="h-4 w-4" />}
        />
      </FilterGroup>

      <FilterGroup title="Tags">
        {tags.length === 0 ? (
          <p className="text-tertiary text-caption px-1">
            Tags you add to a document show up here.
          </p>
        ) : (
          tags.map(([tag, count]) => <FilterRow key={tag} label={tag} count={count} />)
        )}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-tertiary text-caption mb-2 px-1 tracking-wide uppercase">{title}</h2>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function FilterRow({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn('text-body-sm text-secondary flex items-center gap-2 rounded-md px-2 py-1.5')}
    >
      {icon ? <span className="text-tertiary shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-tertiary text-caption shrink-0 tabular-nums">{count}</span>
    </div>
  );
}
