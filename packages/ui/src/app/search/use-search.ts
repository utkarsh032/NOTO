import { SearchIndex, plainTextFromContent } from '@noto/core';
import type { MemoryItem, MemoryKind, NotoDocument } from '@noto/types';
import { useMemo, useState } from 'react';

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
 * The index (`SearchIndex` in `@noto/core`) lives as long as the screen and is
 * brought up to date entry by entry: a document is re-read into it only when
 * it has changed, so typing a query does not extract the text of every
 * document on every keystroke, which is what the substring scan it replaced
 * did.
 */
export function useSearch(query: string, memoryItems: readonly MemoryItem[]): SearchResults {
  const { documents } = useNotoData();
  const [index] = useState(() => new SearchIndex());

  /* What each id refers to, and its plain text, for the hits. Rebuilt with the index. */
  const sources = useMemo(() => {
    const byId = new Map<string, Omit<SearchHit, 'score'>>();
    const live = new Set<string>();

    for (const document of documents ?? []) {
      const id = `document-${document.id}`;
      const body = plainTextFor(document);
      live.add(id);

      index.upsert({
        id,
        title: document.title,
        body,
        tags: document.tags,
        stamp: `${document.updatedAt}:${document.contentHash ?? ''}`,
      });
      byId.set(id, {
        id,
        source: 'document',
        kind: 'document',
        title: document.title || 'Untitled',
        body,
        location: 'Documents',
        updatedAt: document.updatedAt,
        tags: document.tags,
        document,
      });
    }

    for (const item of memoryItems) {
      const id = `memory-${item.id}`;
      live.add(id);

      index.upsert({
        id,
        title: item.title,
        body: `${item.content}
${item.source ?? ''}`,
        tags: item.tags,
        stamp: item.updatedAt,
      });
      byId.set(id, {
        id,
        source: 'memory',
        kind: item.kind,
        title: item.title,
        body: item.content,
        location: item.source ?? 'Noto Memory',
        updatedAt: item.updatedAt,
        tags: item.tags,
        item,
      });
    }

    index.retain(live);
    return byId;
  }, [index, documents, memoryItems]);

  return useMemo(() => {
    const empty: Record<SearchScope, number> = {
      all: 0,
      documents: 0,
      memory: 0,
      clipboard: 0,
      image: 0,
      link: 0,
      file: 0,
    };

    if (query.trim() === '') return { hits: [], top: [], countsByScope: empty };

    const hits: SearchHit[] = [];
    for (const { id, score } of index.search(query)) {
      const source = sources.get(id);
      // Documents a little above Memory at an equal match: they are what was written on purpose.
      if (source) hits.push({ ...source, score: score + (source.source === 'document' ? 10 : 0) });
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
  }, [query, index, sources]);
}

/*
 * Plain text per document version, shared by every search in the window: the
 * extraction walks the whole document, and a document that has not changed
 * has the same text it had a keystroke ago.
 */
const plainTextCache = new Map<string, { stamp: string; text: string }>();

function plainTextFor(document: NotoDocument): string {
  const stamp = `${document.updatedAt}:${document.contentHash ?? ''}`;
  const cached = plainTextCache.get(document.id);
  if (cached?.stamp === stamp) return cached.text;

  const text = plainTextFromContent(document.content);
  plainTextCache.set(document.id, { stamp, text });
  return text;
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
