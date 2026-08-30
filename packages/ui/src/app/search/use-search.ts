import { plainTextFromContent } from '@noto/core';
import type { MemoryItem, MemoryKind, NotoDocument } from '@noto/types';
import { useMemo } from 'react';

import { useNotoData } from '../data-context';

export type SearchScope = 'all' | 'documents' | 'memory' | 'clipboard' | 'image' | 'link' | 'file';

export interface SearchHit {
  id: string;
  /** Where the hit came from, which decides its icon and its section. */
  source: 'document' | 'memory';
  kind: MemoryKind | 'document';
  title: string;
  /** The text the match was found in, for the highlighted snippet. */
  body: string;
  location: string;
  updatedAt: string;
  tags: string[];
  /** Higher is better. Title matches beat body matches. */
  score: number;
  document?: NotoDocument;
  item?: MemoryItem;
}

/** A title match is worth far more than a body match, and an exact one more still. */
function scoreOf(title: string, body: string, needle: string): number {
  const haystackTitle = title.toLowerCase();
  const haystackBody = body.toLowerCase();

  let score = 0;
  if (haystackTitle === needle) score += 100;
  if (haystackTitle.includes(needle)) score += 50;
  if (haystackTitle.startsWith(needle)) score += 15;

  const occurrences = haystackBody.split(needle).length - 1;
  score += Math.min(occurrences, 5) * 6;

  return score;
}

export interface SearchResults {
  /** Everything that matched, best first. */
  hits: SearchHit[];
  /** The three or four best, shown above the grouped sections. */
  top: SearchHit[];
  countsByScope: Record<SearchScope, number>;
}

/**
 * Search across documents and memory at once.
 *
 * One index over two sources, ranked together, because "where did I write that"
 * is one question — the user does not know, and should not have to, whether the
 * thing they remember ended up in a document or on the clipboard.
 *
 * The matching is a substring scan, which is exactly right for a local
 * workspace of this size and deliberately not pretending to be more: there is
 * no stemming and no fuzzy matching, so a result is always something that
 * literally contains what was typed.
 */
export function useSearch(query: string, memoryItems: readonly MemoryItem[]): SearchResults {
  const { documents } = useNotoData();

  return useMemo(() => {
    const needle = query.trim().toLowerCase();

    const empty: Record<SearchScope, number> = {
      all: 0,
      documents: 0,
      memory: 0,
      clipboard: 0,
      image: 0,
      link: 0,
      file: 0,
    };

    if (needle === '') return { hits: [], top: [], countsByScope: empty };

    const hits: SearchHit[] = [];

    for (const document of documents ?? []) {
      const body = plainTextFromContent(document.content);
      if (!`${document.title}\n${body}`.toLowerCase().includes(needle)) continue;

      hits.push({
        id: `document-${document.id}`,
        source: 'document',
        kind: 'document',
        title: document.title || 'Untitled',
        body,
        location: 'Documents',
        updatedAt: document.updatedAt,
        tags: document.tags,
        score: scoreOf(document.title, body, needle) + 10,
        document,
      });
    }

    for (const item of memoryItems) {
      const haystack = `${item.title}\n${item.content}\n${item.tags.join(' ')}`;
      if (!haystack.toLowerCase().includes(needle)) continue;

      hits.push({
        id: `memory-${item.id}`,
        source: 'memory',
        kind: item.kind,
        title: item.title,
        body: item.content,
        location: item.source ?? 'Noto Memory',
        updatedAt: item.updatedAt,
        tags: item.tags,
        score: scoreOf(item.title, item.content, needle),
        item,
      });
    }

    /* Recency breaks ties: two equally good matches, the newer one first. */
    hits.sort(
      (left, right) =>
        right.score - left.score || Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );

    const countsByScope = { ...empty, all: hits.length };
    for (const hit of hits) {
      if (hit.source === 'document') countsByScope.documents += 1;
      else {
        countsByScope.memory += 1;
        if (hit.kind === 'clipboard') countsByScope.clipboard += 1;
        if (hit.kind === 'image' || hit.kind === 'screenshot') countsByScope.image += 1;
        if (hit.kind === 'link') countsByScope.link += 1;
        if (hit.kind === 'file') countsByScope.file += 1;
      }
    }

    return { hits, top: hits.slice(0, 3), countsByScope };
  }, [query, documents, memoryItems]);
}

/** Whether a hit belongs in the section a tab is showing. */
export function matchesScope(hit: SearchHit, scope: SearchScope): boolean {
  switch (scope) {
    case 'all':
      return true;
    case 'documents':
      return hit.source === 'document';
    case 'memory':
      return hit.source === 'memory';
    case 'clipboard':
      return hit.kind === 'clipboard';
    case 'image':
      return hit.kind === 'image' || hit.kind === 'screenshot';
    case 'link':
      return hit.kind === 'link';
    case 'file':
      return hit.kind === 'file';
    default:
      return true;
  }
}
