import {
  createMemoryItem,
  deleteMemoryItem,
  updateMemoryItem,
  type CreateMemoryInput,
} from '@noto/core';
import type { MemoryItem, MemoryKind } from '@noto/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isWithinDays } from '../../utils/format';
import { notifyDataChanged, useDataRevision } from '../data-events';
import { useNotoData } from '../data-context';

export interface MemoryQuery {
  kind: MemoryKind | 'all';
  /** Free text, matched against title, content, source and tags. */
  text: string;
  pinnedOnly?: boolean;
  /**
   * How far back to look, in days. `null` for any age.
   *
   * A span rather than a cut-off timestamp: a timestamp computed while
   * rendering is a different number on every render, so the option that is
   * currently chosen could never match the one in the list.
   */
  sinceDays?: number | null;
}

/** What a capture supplies; the workspace is filled in by the hook. */
export type MemoryCapture = Omit<CreateMemoryInput, 'workspaceId'>;

export interface MemoryValue {
  /** `true` until the first read from storage has come back. */
  loading: boolean;
  /** Everything captured, newest first. */
  items: MemoryItem[];
  /** What survives the current query. */
  results: MemoryItem[];
  query: MemoryQuery;
  setQuery(next: Partial<MemoryQuery>): void;
  countsByKind: Record<MemoryKind | 'all', number>;
  /** Resolves once the change is on disk. */
  togglePin(item: MemoryItem): Promise<void>;
  /** Soft-deletes. Resolves once the tombstone is on disk. */
  remove(id: string): Promise<void>;
  /** Saves something new into Memory. Resolves with it, or `null` before storage is open. */
  capture(input: MemoryCapture): Promise<MemoryItem | null>;
}

const EMPTY_COUNTS: Record<MemoryKind | 'all', number> = {
  all: 0,
  note: 0,
  clipboard: 0,
  screenshot: 0,
  image: 0,
  link: 0,
  file: 0,
};

/**
 * Saves into Memory from anywhere — Quick Note, the Smart Sidebar, the dock —
 * without subscribing to the list. Every Memory view re-reads afterwards.
 */
export function useMemoryCapture(): MemoryValue['capture'] {
  const { database, workspace } = useNotoData();

  return useCallback(
    async (input: MemoryCapture) => {
      if (!database || !workspace) return null;

      const item = createMemoryItem({ ...input, workspaceId: workspace.id });
      await database.memory.put(item);
      notifyDataChanged('memory');

      return item;
    },
    [database, workspace],
  );
}

/**
 * Noto Memory.
 *
 * Read from the device's own storage, newest first, and re-read whenever any
 * window writes to it. Filtering is a pass over the list in memory: the query
 * changes on every keystroke, and a list of a few thousand captured items
 * filters faster than a round trip to SQLite over IPC. The screen renders
 * through a virtual list, so what grows with the list is the row count, not
 * the number of DOM nodes.
 */
export function useMemory(initialKind: MemoryKind | 'all' = 'all'): MemoryValue {
  const { database, workspace } = useNotoData();
  const revision = useDataRevision('memory');
  const capture = useMemoryCapture();

  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [query, setQueryState] = useState<MemoryQuery>({
    kind: initialKind,
    text: '',
    pinnedOnly: false,
    sinceDays: null,
  });

  useEffect(() => {
    if (!database || !workspace) return;

    let cancelled = false;
    void database.memory.listByWorkspace(workspace.id).then((rows) => {
      if (!cancelled) setItems(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [database, workspace, revision]);

  const loaded = useMemo(() => items ?? [], [items]);

  const results = useMemo(() => {
    const needle = query.text.trim().toLowerCase();

    return loaded.filter((item) => {
      if (query.kind !== 'all' && item.kind !== query.kind) return false;
      if (query.pinnedOnly && !item.isPinned) return false;
      if (query.sinceDays && !isWithinDays(item.updatedAt, query.sinceDays)) return false;
      if (needle === '') return true;

      return (
        item.title.toLowerCase().includes(needle) ||
        item.content.toLowerCase().includes(needle) ||
        (item.source ?? '').toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [loaded, query]);

  const countsByKind = useMemo(() => {
    const counts = { ...EMPTY_COUNTS, all: loaded.length };
    for (const item of loaded) counts[item.kind] += 1;
    return counts;
  }, [loaded]);

  const setQuery = useCallback((next: Partial<MemoryQuery>) => {
    setQueryState((current) => ({ ...current, ...next }));
  }, []);

  /*
   * Written through and then re-read. The list is updated optimistically first
   * so a pin does not wait on a disk write to show.
   */
  const togglePin = useCallback(
    async (item: MemoryItem) => {
      if (!database) return;

      const next = updateMemoryItem(item, { isPinned: !item.isPinned });
      setItems((current) => current?.map((row) => (row.id === item.id ? next : row)) ?? null);
      await database.memory.put(next);
      notifyDataChanged('memory');
    },
    [database],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!database) return;

      // Started from the list on screen, so the tombstone is one write, not a
      // read and then a write.
      const existing = loaded.find((row) => row.id === id) ?? (await database.memory.get(id));
      if (!existing) return;

      setItems((current) => current?.filter((row) => row.id !== id) ?? null);
      await database.memory.put(deleteMemoryItem(existing));
      notifyDataChanged('memory');
    },
    [database, loaded],
  );

  /* Memoised: screens keep this in effect dependencies, and a fresh object on
     every render would re-run them forever. */
  return useMemo(
    () => ({
      loading: items === null,
      items: loaded,
      results,
      query,
      setQuery,
      countsByKind,
      togglePin,
      remove,
      capture,
    }),
    [items, loaded, results, query, setQuery, countsByKind, togglePin, remove, capture],
  );
}
