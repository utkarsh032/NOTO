import type {
  CreateFolderInput,
  Folder,
  FolderNode,
  Id,
  NotoDocument,
  NotoError,
  Result,
  UpdateFolderInput,
} from '@noto/types';

import { type Clock, systemClock } from './clock.ts';
import { createId } from './id.ts';
import { err, ok } from './result.ts';

export interface FolderDeps {
  clock?: Clock;
  generateId?: () => string;
}

export function createFolder(input: CreateFolderInput, deps: FolderDeps = {}): Folder {
  const clock = deps.clock ?? systemClock;
  const generateId = deps.generateId ?? createId;
  const timestamp = clock.now();

  return {
    id: generateId(),
    workspaceId: input.workspaceId,
    parentId: input.parentId ?? null,
    name: input.name.trim(),
    position: 0,
    color: input.color ?? null,
    icon: input.icon ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

export function updateFolder(
  folder: Folder,
  patch: UpdateFolderInput,
  deps: FolderDeps = {},
): Folder {
  const clock = deps.clock ?? systemClock;
  return { ...folder, ...patch, updatedAt: clock.now() };
}

/** Walks up the parent chain to decide whether `candidateId` sits under `ancestorId`. */
export function isDescendantOf(
  folders: readonly Folder[],
  candidateId: Id,
  ancestorId: Id,
): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  let current = byId.get(candidateId)?.parentId ?? null;
  const visited = new Set<Id>([candidateId]);

  while (current !== null) {
    if (current === ancestorId) return true;
    // Guards against a cycle already present in corrupt data.
    if (visited.has(current)) return false;
    visited.add(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return false;
}

/**
 * Reparents a folder, refusing moves that would detach a subtree from the root
 * by making a folder its own ancestor.
 */
export function moveFolder(
  folders: readonly Folder[],
  folderId: Id,
  newParentId: Id | null,
  deps: FolderDeps = {},
): Result<Folder, NotoError> {
  const folder = folders.find((candidate) => candidate.id === folderId);
  if (!folder) {
    return err('not_found', `Folder ${folderId} does not exist.`);
  }

  if (newParentId !== null) {
    if (newParentId === folderId) {
      return err('invalid_input', 'A folder cannot be moved into itself.');
    }

    const parentExists = folders.some((candidate) => candidate.id === newParentId);
    if (!parentExists) {
      return err('not_found', `Folder ${newParentId} does not exist.`);
    }

    if (isDescendantOf(folders, newParentId, folderId)) {
      return err('invalid_input', 'A folder cannot be moved into one of its own descendants.');
    }
  }

  return ok(updateFolder(folder, { parentId: newParentId }, deps));
}

/**
 * Builds the sidebar tree. Live folders only; documents are counted against the
 * folder that directly contains them.
 */
export function buildFolderTree(
  folders: readonly Folder[],
  documents: readonly NotoDocument[] = [],
): FolderNode[] {
  const documentCounts = new Map<Id, number>();
  for (const document of documents) {
    if (document.deletedAt !== null || document.folderId === null) continue;
    documentCounts.set(document.folderId, (documentCounts.get(document.folderId) ?? 0) + 1);
  }

  const nodes = new Map<Id, FolderNode>();
  for (const folder of folders) {
    if (folder.deletedAt !== null) continue;
    nodes.set(folder.id, {
      ...folder,
      children: [],
      documentCount: documentCounts.get(folder.id) ?? 0,
    });
  }

  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      // Orphans (parent deleted or missing) surface at the root rather than vanishing.
      roots.push(node);
    }
  }

  const sortRecursively = (siblings: FolderNode[]): void => {
    siblings.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const sibling of siblings) sortRecursively(sibling.children);
  };
  sortRecursively(roots);

  return roots;
}
