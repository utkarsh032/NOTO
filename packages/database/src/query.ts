import type { Entity, MemoryItem, NotoDocument, SyncOperation } from '@noto/types';

import type { ListDocumentsOptions, ListMemoryOptions, ListOptions, TagCount } from './types';

/** Drops tombstones unless the caller asked for them. */
export function applyDeletedFilter<T extends Pick<Entity, 'deletedAt'>>(
  rows: readonly T[],
  options: ListOptions | undefined,
): T[] {
  if (options?.includeDeleted) return [...rows];
  return rows.filter((row) => row.deletedAt === null);
}

/** Applies offset/limit after all filtering and sorting has happened. */
export function applyPagination<T>(rows: readonly T[], options: ListOptions | undefined): T[] {
  const offset = options?.offset ?? 0;
  const limit = options?.limit;
  return limit === undefined ? rows.slice(offset) : rows.slice(offset, offset + limit);
}

/** Newest first. Ties fall back to id so ordering is stable across runs. */
export function byUpdatedAtDesc<T extends { updatedAt: string; id: string }>(a: T, b: T): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Document filtering shared by every adapter that has to post-process rows in
 * memory (Dexie and the in-memory store). Keeping it here is what guarantees
 * the platforms agree on what `listByWorkspace` means.
 */
export function filterDocuments(
  rows: readonly NotoDocument[],
  options: ListDocumentsOptions | undefined,
): NotoDocument[] {
  let result = [...rows];

  if (options?.folderId !== undefined) {
    result = result.filter((row) => row.folderId === options.folderId);
  }
  if (options?.status !== undefined) {
    result = result.filter((row) => row.status === options.status);
  }
  if (options?.favoritesOnly) {
    result = result.filter((row) => row.isFavorite);
  }
  if (options?.tag !== undefined) {
    const tag = options.tag;
    result = result.filter((row) => row.tags.includes(tag));
  }

  return result;
}

export function documentComparator(
  orderBy: ListDocumentsOptions['orderBy'],
): (a: NotoDocument, b: NotoDocument) => number {
  switch (orderBy) {
    case 'createdAt':
      return (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    case 'title':
      return (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    default:
      return byUpdatedAtDesc;
  }
}

export function matchesDocumentSearch(document: NotoDocument, needle: string): boolean {
  if (needle === '') return true;
  return (
    document.title.toLowerCase().includes(needle) || document.excerpt.toLowerCase().includes(needle)
  );
}

/** Tag usage across live documents: most used first, then alphabetical. */
export function countTags(rows: readonly Pick<NotoDocument, 'tags' | 'deletedAt'>[]): TagCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.deletedAt !== null) continue;
    for (const tag of new Set(row.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function filterMemory(
  rows: readonly MemoryItem[],
  options: ListMemoryOptions | undefined,
): MemoryItem[] {
  let result = [...rows];

  if (options?.kind !== undefined) result = result.filter((row) => row.kind === options.kind);
  if (options?.pinnedOnly) result = result.filter((row) => row.isPinned);

  return result;
}

export function matchesMemorySearch(item: MemoryItem, needle: string): boolean {
  if (needle === '') return true;

  return (
    item.title.toLowerCase().includes(needle) ||
    item.content.toLowerCase().includes(needle) ||
    (item.source ?? '').toLowerCase().includes(needle) ||
    item.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

/**
 * What an outbox entry should say after one more local save.
 *
 * A row that has never been pushed stays a `create` however often it is
 * edited — the server has never heard of it. A soft delete is a `delete`.
 */
export function nextOutboxOperation(
  previous: SyncOperation | undefined,
  existedBefore: boolean,
  deleted: boolean,
): SyncOperation {
  if (deleted) return 'delete';
  if (previous === 'create') return 'create';
  return existedBefore ? 'update' : 'create';
}
