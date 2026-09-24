import type { Id, MemoryItem, MemoryKind } from '@noto/types';

import { type Clock, systemClock } from './clock.ts';
import { createId } from './id.ts';

export interface CreateMemoryInput {
  workspaceId: Id;
  kind: MemoryKind;
  content: string;
  title?: string;
  source?: string | null;
  url?: string | null;
  tags?: string[];
  sizeBytes?: number | null;
}

export interface MemoryDeps {
  clock?: Clock;
  generateId?: () => string;
}

/** The longest a derived title may be before it is cut at a word. */
const TITLE_LENGTH = 80;

/**
 * A heading for something captured without one.
 *
 * The first non-empty line, cut at a word boundary. A link with no text is
 * titled by its host, which is what a person scanning the list recognises.
 */
export function memoryTitleFrom(content: string, url: string | null = null): string {
  const line = content
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '');

  if (line) {
    if (line.length <= TITLE_LENGTH) return line;
    const cut = line.slice(0, TITLE_LENGTH);
    const space = cut.lastIndexOf(' ');
    return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }

  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  return 'Untitled';
}

export function createMemoryItem(input: CreateMemoryInput, deps: MemoryDeps = {}): MemoryItem {
  const clock = deps.clock ?? systemClock;
  const generateId = deps.generateId ?? createId;
  const timestamp = clock.now();
  const url = input.url ?? null;

  return {
    id: generateId(),
    workspaceId: input.workspaceId,
    kind: input.kind,
    title: input.title?.trim() || memoryTitleFrom(input.content, url),
    content: input.content,
    source: input.source ?? null,
    url,
    tags: [...new Set(input.tags ?? [])],
    isPinned: false,
    sizeBytes: input.sizeBytes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

export function updateMemoryItem(
  item: MemoryItem,
  patch: Partial<Pick<MemoryItem, 'title' | 'content' | 'tags' | 'isPinned'>>,
  deps: MemoryDeps = {},
): MemoryItem {
  const clock = deps.clock ?? systemClock;

  return { ...item, ...patch, updatedAt: clock.now() };
}

/** Soft-deletes, like documents: the tombstone is what removes it elsewhere. */
export function deleteMemoryItem(item: MemoryItem, deps: MemoryDeps = {}): MemoryItem {
  const timestamp = (deps.clock ?? systemClock).now();
  return { ...item, deletedAt: timestamp, updatedAt: timestamp };
}

/** Roughly what Memory takes up: stored sizes for assets, UTF-16 for text. */
export function memoryStorageBytes(
  items: readonly Pick<MemoryItem, 'sizeBytes' | 'content'>[],
): number {
  return items.reduce((total, item) => total + (item.sizeBytes ?? item.content.length * 2), 0);
}
