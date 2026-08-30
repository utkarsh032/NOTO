import type { MemoryItem, MemoryKind } from '@noto/types';
import { useCallback, useMemo, useState } from 'react';

import { buildMemoryItems } from '../../mock/memory';
import { isWithinDays } from '../../utils/format';
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

export interface MemoryValue {
  /** Everything captured, newest first. */
  items: MemoryItem[];
  /** What survives the current query. */
  results: MemoryItem[];
  query: MemoryQuery;
  setQuery(next: Partial<MemoryQuery>): void;
  countsByKind: Record<MemoryKind | 'all', number>;
  togglePin(item: MemoryItem): void;
  remove(id: string): void;
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
 * Noto Memory.
 *
 * The capture services — clipboard watching, screenshots, link saving — are not
 * built yet, so the items come from the fixture and the mutations live in React
 * state: pinning and removing work for the session, and nothing pretends to
 * have been written to disk. When a memory repository exists, this hook is the
 * one thing that changes.
 *
 * Filtering is a pass over an array here, which is honest at fixture size. The
 * screen does not rely on it staying that way: it renders through a virtual
 * list, so the row count is what grows, not the number of DOM nodes.
 */
export function useMemory(initialKind: MemoryKind | 'all' = 'all'): MemoryValue {
  const { workspace } = useNotoData();

  const [overrides, setOverrides] = useState<Record<string, Partial<MemoryItem>>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [query, setQueryState] = useState<MemoryQuery>({
    kind: initialKind,
    text: '',
    pinnedOnly: false,
    sinceDays: null,
  });

  const items = useMemo(() => {
    const base = buildMemoryItems(workspace?.id ?? 'local');

    return base
      .filter((item) => !removed.includes(item.id))
      .map((item) => ({ ...item, ...overrides[item.id] }))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }, [workspace?.id, overrides, removed]);

  const results = useMemo(() => {
    const needle = query.text.trim().toLowerCase();

    return items.filter((item) => {
      if (query.kind !== 'all' && item.kind !== query.kind) return false;
      if (query.pinnedOnly && !item.isPinned) return false;
      if (query.sinceDays && !isWithinDays(item.updatedAt, query.sinceDays)) return false;
      if (needle === '') return true;

      return (
        item.title.toLowerCase().includes(needle) ||
        item.content.toLowerCase().includes(needle) ||
        (item.source ?? '').toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.includes(needle))
      );
    });
  }, [items, query]);

  const countsByKind = useMemo(() => {
    const counts = { ...EMPTY_COUNTS, all: items.length };
    for (const item of items) counts[item.kind] += 1;
    return counts;
  }, [items]);

  const setQuery = useCallback((next: Partial<MemoryQuery>) => {
    setQueryState((current) => ({ ...current, ...next }));
  }, []);

  /* The item, not its id: `items` has already merged the overrides in, so the
     value on the item is the effective one to invert. */
  const togglePin = useCallback((item: MemoryItem) => {
    setOverrides((current) => ({
      ...current,
      [item.id]: { ...current[item.id], isPinned: !item.isPinned },
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setRemoved((current) => [...current, id]);
  }, []);

  /* Memoised: screens keep this in effect dependencies, and a fresh object on
     every render would re-run them forever. */
  return useMemo(
    () => ({ items, results, query, setQuery, countsByKind, togglePin, remove }),
    [items, results, query, setQuery, countsByKind, togglePin, remove],
  );
}
