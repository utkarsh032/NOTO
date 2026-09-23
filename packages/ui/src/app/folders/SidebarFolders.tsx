import type { FolderNode, Id, NotoDocument } from '@noto/types';
import { type DragEvent, useMemo, useState } from 'react';

import { IconButton } from '../../components/IconButton';
import { Skeleton } from '../../components/Skeleton';
import { showToast } from '../../components/toast-store';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../../components/icons';
import { cn } from '../../utils/cn';
import { RenameRow, SidebarDocumentList } from '../SidebarDocumentList';
import { DOCUMENT_DRAG_TYPE, FOLDER_DRAG_TYPE } from './drag-types';
import { useFolders } from './use-folders';

export interface SidebarFoldersProps {
  /** The workspace's name, shown as the heading the root is dropped on. */
  heading: string;
  headingId: string;
  /** `undefined` while the first query is in flight. */
  documents: NotoDocument[] | undefined;
  activeId: Id | null;
  onOpen(id: Id): void;
  onRename(id: Id, title: string): void;
  onDelete(document: NotoDocument): void;
}

type DropTarget = Id | 'root';

/** Whether a drag carries something the sidebar knows how to move. */
function carriesNotoItem(event: DragEvent): boolean {
  const types = event.dataTransfer.types;
  return types.includes(DOCUMENT_DRAG_TYPE) || types.includes(FOLDER_DRAG_TYPE);
}

/**
 * The workspace's folders and documents, as a tree.
 *
 * Folders first, then the documents at the root. Anything can be dragged: a
 * document onto a folder moves it in, a folder onto another nests it, and
 * either dropped on the workspace heading goes back to the root. Every one of
 * those is also reachable without a pointer — the folder picker in the
 * document's Info tab moves a document, and a folder's own buttons create,
 * rename and remove.
 */
export function SidebarFolders({
  heading,
  headingId,
  documents,
  activeId,
  onOpen,
  onRename,
  onDelete,
}: SidebarFoldersProps) {
  const folders = useFolders();
  const [collapsed, setCollapsed] = useState<ReadonlySet<Id>>(new Set());
  const [renaming, setRenaming] = useState<Id | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const byFolder = useMemo(() => {
    const map = new Map<Id | null, NotoDocument[]>();
    for (const document of documents ?? []) {
      const key = document.folderId ?? null;
      map.set(key, [...(map.get(key) ?? []), document]);
    }
    return map;
  }, [documents]);

  // A document in a folder that has gone is shown at the root, not lost.
  const knownFolders = useMemo(() => new Set(folders.folders.map((f) => f.id)), [folders.folders]);
  const rootDocuments = useMemo(
    () =>
      (documents ?? []).filter(
        (document) => document.folderId === null || !knownFolders.has(document.folderId),
      ),
    [documents, knownFolders],
  );

  const toggle = (id: Id) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createFolder = async (parentId: Id | null) => {
    const folder = await folders.create('New folder', parentId);
    if (!folder) return;

    if (parentId) setCollapsed((current) => new Set([...current].filter((id) => id !== parentId)));
    setRenaming(folder.id);
  };

  const dropInto = async (target: Id | null, event: DragEvent) => {
    event.preventDefault();
    setDropTarget(null);

    const documentId = event.dataTransfer.getData(DOCUMENT_DRAG_TYPE);
    if (documentId) {
      await folders.moveDocument(documentId, target);
      return;
    }

    const folderId = event.dataTransfer.getData(FOLDER_DRAG_TYPE);
    if (folderId && folderId !== target) {
      const moved = await folders.move(folderId, target);
      if (!moved.ok) showToast(moved.reason, { tone: 'error' });
    }
  };

  const dropHandlers = (target: DropTarget) => ({
    onDragOver: (event: DragEvent) => {
      if (!carriesNotoItem(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (event: DragEvent) => void dropInto(target === 'root' ? null : target, event),
  });

  const renderFolder = (node: FolderNode, depth: number) => {
    const isOpen = !collapsed.has(node.id);
    const contents = byFolder.get(node.id) ?? [];

    return (
      <li key={node.id}>
        {renaming === node.id ? (
          <div style={{ paddingLeft: depth * 12 }}>
            <RenameRow
              title={node.name}
              label={`Rename folder ${node.name}`}
              onCommit={(name) => {
                setRenaming(null);
                void folders.rename(node.id, name);
              }}
              onCancel={() => setRenaming(null)}
            />
          </div>
        ) : (
          <div
            className={cn(
              'group/folder relative rounded-md',
              dropTarget === node.id && 'bg-brand-soft outline-brand outline-2',
            )}
            {...dropHandlers(node.id)}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(node.id)}
              onDoubleClick={() => setRenaming(node.id)}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(FOLDER_DRAG_TYPE, node.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              style={{ paddingLeft: 6 + depth * 12 }}
              className="text-secondary hover:bg-surface hover:text-primary focus-visible:outline-brand text-body-sm flex w-full items-center gap-1.5 rounded-md py-1.5 pr-20 text-left font-medium focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              {isOpen ? (
                <ChevronDownIcon className="text-tertiary h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRightIcon className="text-tertiary h-3.5 w-3.5 shrink-0" />
              )}
              {isOpen ? (
                <FolderOpenIcon className="text-brand h-4 w-4 shrink-0" />
              ) : (
                <FolderIcon className="text-brand h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              <span className="text-tertiary text-caption tabular-nums">{node.documentCount}</span>
            </button>

            <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 transition group-hover/folder:opacity-100 focus-within:opacity-100">
              <IconButton
                size="sm"
                label={`New folder in ${node.name}`}
                icon={<PlusIcon className="h-3.5 w-3.5" />}
                onClick={() => void createFolder(node.id)}
              />
              <IconButton
                size="sm"
                label={`Rename folder ${node.name}`}
                icon={<PencilIcon className="h-3.5 w-3.5" />}
                onClick={() => setRenaming(node.id)}
              />
              <IconButton
                size="sm"
                label={`Remove folder ${node.name}`}
                icon={<TrashIcon className="h-3.5 w-3.5" />}
                onClick={() =>
                  void folders
                    .remove(node.id)
                    .then(() =>
                      showToast(`Removed “${node.name}”. What was in it moved up a level.`),
                    )
                }
              />
            </div>
          </div>
        )}

        {isOpen && (node.children.length > 0 || contents.length > 0) ? (
          <div style={{ paddingLeft: (depth + 1) * 12 }}>
            {node.children.length > 0 ? (
              <ul className="flex flex-col gap-0.5" aria-label={`Folders in ${node.name}`}>
                {node.children.map((child) => renderFolder(child, 0))}
              </ul>
            ) : null}
            {contents.length > 0 ? (
              <SidebarDocumentList
                documents={contents}
                activeId={activeId}
                label={`Documents in ${node.name}`}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md pr-1',
          dropTarget === 'root' && 'bg-brand-soft outline-brand outline-2',
        )}
        {...dropHandlers('root')}
      >
        {/* Read against the list it labels, this says which workspace these are. */}
        <h2
          id={headingId}
          className="text-tertiary text-caption min-w-0 flex-1 truncate px-2.5 py-1 tracking-wide uppercase"
        >
          {heading}
        </h2>
        <IconButton
          size="sm"
          label="New folder"
          icon={<PlusIcon className="h-3.5 w-3.5" />}
          onClick={() => void createFolder(null)}
        />
      </div>

      {documents === undefined ? (
        /* A skeleton in the shape of the list, rather than a spinner in a
           sidebar-sized hole. */
        <ul className="flex flex-col gap-1" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="px-2.5 py-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {folders.tree.length > 0 ? (
            <ul className="mb-1 flex flex-col gap-0.5" aria-label="Folders">
              {folders.tree.map((node) => renderFolder(node, 0))}
            </ul>
          ) : null}

          {rootDocuments.length > 0 ? (
            <SidebarDocumentList
              documents={rootDocuments}
              activeId={activeId}
              label="All documents"
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          ) : documents.length === 0 ? (
            <p className="text-tertiary text-caption px-2.5 py-3">
              No documents yet. Start one and it will appear here.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
