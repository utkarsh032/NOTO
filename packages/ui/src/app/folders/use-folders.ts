import {
  buildFolderTree,
  createFolder,
  deleteFolder,
  folderPath,
  moveFolder,
  updateFolder,
} from '@noto/core';
import type { Folder, FolderNode, Id } from '@noto/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { notifyDataChanged, useDataRevision } from '../data-events';
import { useNotoData } from '../data-context';

export interface FoldersValue {
  /** Live folders, flat. Empty while loading. */
  folders: Folder[];
  /** The same folders as a tree, with direct document counts. */
  tree: FolderNode[];
  create(name: string, parentId?: Id | null): Promise<Folder | null>;
  rename(id: Id, name: string): Promise<void>;
  /** Refuses — with a reason — a move that would put a folder inside itself. */
  move(id: Id, parentId: Id | null): Promise<{ ok: true } | { ok: false; reason: string }>;
  /**
   * Removes a folder and nothing in it: its documents and subfolders move up
   * to where the folder was. Deleting a folder is tidying, not deleting work.
   */
  remove(id: Id): Promise<void>;
  moveDocument(documentId: Id, folderId: Id | null): Promise<void>;
  /** "Work / Plans" for a folder id; empty for the workspace root. */
  pathOf(folderId: Id | null): string[];
}

/** Folders in the open workspace, re-read whenever any window changes one. */
export function useFolders(): FoldersValue {
  const { database, workspace, documents, updateDocument } = useNotoData();
  const revision = useDataRevision('folders');
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    if (!database || !workspace) return;

    let cancelled = false;
    void database.folders.listByWorkspace(workspace.id).then((rows) => {
      if (!cancelled) setFolders(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [database, workspace, revision]);

  const tree = useMemo(() => buildFolderTree(folders, documents ?? []), [folders, documents]);

  const save = useCallback(
    async (folder: Folder) => {
      if (!database) return;
      await database.folders.put(folder);
      notifyDataChanged('folders');
    },
    [database],
  );

  const create = useCallback(
    async (name: string, parentId: Id | null = null) => {
      if (!workspace) return null;

      const folder = createFolder({ workspaceId: workspace.id, name, parentId });
      setFolders((current) => [...current, folder]);
      await save(folder);
      return folder;
    },
    [workspace, save],
  );

  const rename = useCallback(
    async (id: Id, name: string) => {
      const folder = folders.find((candidate) => candidate.id === id);
      const trimmed = name.trim();
      if (!folder || trimmed === '' || trimmed === folder.name) return;

      await save(updateFolder(folder, { name: trimmed }));
    },
    [folders, save],
  );

  const move = useCallback(
    async (id: Id, parentId: Id | null) => {
      const moved = moveFolder(folders, id, parentId);
      if (!moved.ok) return { ok: false as const, reason: moved.error.message };

      await save(moved.value);
      return { ok: true as const };
    },
    [folders, save],
  );

  const moveDocument = useCallback(
    async (documentId: Id, folderId: Id | null) => {
      await updateDocument(documentId, { folderId });
    },
    [updateDocument],
  );

  const remove = useCallback(
    async (id: Id) => {
      const folder = folders.find((candidate) => candidate.id === id);
      if (!folder || !database) return;

      const parentId = folder.parentId;

      for (const child of folders.filter((candidate) => candidate.parentId === id)) {
        await database.folders.put(updateFolder(child, { parentId }));
      }
      for (const document of (documents ?? []).filter((candidate) => candidate.folderId === id)) {
        await updateDocument(document.id, { folderId: parentId });
      }

      await save(deleteFolder(folder));
    },
    [folders, documents, database, updateDocument, save],
  );

  const pathOf = useCallback((folderId: Id | null) => folderPath(folders, folderId), [folders]);

  return useMemo(
    () => ({ folders, tree, create, rename, move, remove, moveDocument, pathOf }),
    [folders, tree, create, rename, move, remove, moveDocument, pathOf],
  );
}
