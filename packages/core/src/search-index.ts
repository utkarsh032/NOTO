/**
 * A local full-text index.
 *
 * Built in memory from the documents and Memory items every screen already
 * has loaded, and kept up to date entry by entry: saving a document re-indexes
 * that document and nothing else, which is what makes it cheap enough to run
 * on every keystroke of a search.
 *
 * Every word of a query must match the start of a word in the entry — "prop"
 * finds "proposal" — and the entries that match all of them are ranked:
 * title words above body words, whole words above prefixes, and the exact
 * phrase above scattered words. After those come the entries that only
 * contain what was typed literally — the middle of a word, punctuation — found
 * by a substring scan of the same cached text, so nothing that matched before
 * the index existed stops matching; it just ranks below a real word match.
 *
 * Deliberately in JavaScript rather than SQLite FTS: the three platforms
 * then search identically, and the text is already in memory for the lists.
 */

export interface IndexEntry {
  id: string;
  title: string;
  body: string;
  tags: readonly string[];
  /** Changes whenever the entry does; an unchanged stamp is not re-indexed. */
  stamp: string;
}

export interface IndexHit {
  id: string;
  score: number;
}

interface Stored {
  entry: IndexEntry;
  titleLower: string;
  bodyLower: string;
  /** term -> [title occurrences, body occurrences] */
  terms: Map<string, [number, number]>;
}

const WORD = /[\p{L}\p{N}]+/gu;

/** Lower-cased words, accents kept: "Café" and "cafe" are different words. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(WORD) ?? [];
}

export class SearchIndex {
  private readonly entries = new Map<string, Stored>();
  /** term -> ids containing it */
  private readonly postings = new Map<string, Set<string>>();
  private sortedTerms: string[] | null = null;

  get size(): number {
    return this.entries.size;
  }

  /** Adds or replaces an entry. A no-op when its stamp has not changed. */
  upsert(entry: IndexEntry): void {
    const existing = this.entries.get(entry.id);
    if (existing && existing.entry.stamp === entry.stamp) return;
    if (existing) this.remove(entry.id);

    const terms = new Map<string, [number, number]>();
    const count = (words: readonly string[], slot: 0 | 1) => {
      for (const word of words) {
        const counts = terms.get(word) ?? [0, 0];
        counts[slot] += 1;
        terms.set(word, counts);
      }
    };
    count(tokenize(entry.title), 0);
    count([...tokenize(entry.body), ...entry.tags.flatMap(tokenize)], 1);

    this.entries.set(entry.id, {
      entry,
      titleLower: entry.title.toLowerCase(),
      bodyLower: entry.body.toLowerCase(),
      terms,
    });

    for (const term of terms.keys()) {
      let ids = this.postings.get(term);
      if (!ids) {
        ids = new Set();
        this.postings.set(term, ids);
        this.sortedTerms = null;
      }
      ids.add(entry.id);
    }
  }

  remove(id: string): void {
    const stored = this.entries.get(id);
    if (!stored) return;

    for (const term of stored.terms.keys()) {
      const ids = this.postings.get(term);
      ids?.delete(id);
      if (ids && ids.size === 0) {
        this.postings.delete(term);
        this.sortedTerms = null;
      }
    }
    this.entries.delete(id);
  }

  /** Removes every entry whose id is not in `ids`. */
  retain(ids: ReadonlySet<string>): void {
    for (const id of [...this.entries.keys()]) if (!ids.has(id)) this.remove(id);
  }

  /** Matching entries, best first. Empty for an empty query. */
  search(query: string): IndexHit[] {
    const needle = query.trim().toLowerCase();
    const words = tokenize(needle);
    if (needle === '') return [];

    const ranked = words.length > 0 ? this.byWords(words, needle) : [];
    const found = new Set(ranked.map((hit) => hit.id));

    // Anything that only contains the text mid-word comes after, not never.
    const literal = this.bySubstring(needle).filter((hit) => !found.has(hit.id));
    return [...ranked, ...literal];
  }

  private byWords(words: readonly string[], needle: string): IndexHit[] {
    const expansions = words.map((word) => this.termsStartingWith(word));

    // Entries that contain every word, as a prefix of one of their terms.
    const perWord = expansions.map((terms) => {
      const matching = new Set<string>();
      for (const term of terms) for (const id of this.postings.get(term) ?? []) matching.add(id);
      return matching;
    });
    const [first = new Set<string>(), ...rest] = perWord;
    const candidates = [...first].filter((id) => rest.every((matching) => matching.has(id)));

    const hits: IndexHit[] = [];
    for (const id of candidates) {
      const stored = this.entries.get(id)!;
      let score = 0;

      words.forEach((word, index) => {
        for (const term of expansions[index]!) {
          const counts = stored.terms.get(term);
          if (!counts) continue;

          const exact = term === word ? 2 : 1;
          score += counts[0] * 20 * exact + Math.min(counts[1], 5) * 3 * exact;
        }
      });

      if (stored.titleLower === needle) score += 100;
      else if (stored.titleLower.includes(needle)) score += 40;
      if (words.length > 1 && stored.bodyLower.includes(needle)) score += 15;

      hits.push({ id, score });
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  private bySubstring(needle: string): IndexHit[] {
    const hits: IndexHit[] = [];

    for (const [id, stored] of this.entries) {
      const inTitle = stored.titleLower.includes(needle);
      const inBody =
        stored.bodyLower.includes(needle) ||
        stored.entry.tags.some((tag) => tag.toLowerCase().includes(needle));
      if (!inTitle && !inBody) continue;

      hits.push({ id, score: (inTitle ? 30 : 0) + (inBody ? 5 : 0) });
    }

    return hits.sort((a, b) => b.score - a.score);
  }

  /** Every indexed term beginning with `prefix`, by binary search. */
  private termsStartingWith(prefix: string): string[] {
    this.sortedTerms ??= [...this.postings.keys()].sort();
    const terms = this.sortedTerms;

    let low = 0;
    let high = terms.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (terms[middle]! < prefix) low = middle + 1;
      else high = middle;
    }

    const found: string[] = [];
    for (let index = low; index < terms.length && terms[index]!.startsWith(prefix); index += 1) {
      found.push(terms[index]!);
    }
    return found;
  }
}
