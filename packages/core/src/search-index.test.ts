import { describe, expect, it } from 'vitest';

import { SearchIndex, tokenize } from './search-index.ts';

const entry = (id: string, title: string, body = '', tags: string[] = [], stamp = '1') => ({
  id,
  title,
  body,
  tags,
  stamp,
});

describe('tokenize', () => {
  it('splits on anything that is not a letter or a digit', () => {
    expect(tokenize("Q3 plan — it's done, naïve café")).toEqual([
      'q3',
      'plan',
      'it',
      's',
      'done',
      'naïve',
      'café',
    ]);
  });
});

describe('SearchIndex', () => {
  it('finds words by their start, and requires every word', () => {
    const index = new SearchIndex();
    index.upsert(entry('a', 'Project proposal', 'Budget for the quarter'));
    index.upsert(entry('b', 'Groceries', 'Milk and bread'));

    expect(index.search('prop').map((hit) => hit.id)).toEqual(['a']);
    expect(index.search('prop budget').map((hit) => hit.id)).toEqual(['a']);
    expect(index.search('prop milk')).toEqual([]);
  });

  it('ranks a title match above a body match', () => {
    const index = new SearchIndex();
    index.upsert(entry('body', 'Notes', 'the roadmap is here'));
    index.upsert(entry('title', 'Roadmap', 'nothing else'));

    expect(index.search('roadmap').map((hit) => hit.id)).toEqual(['title', 'body']);
  });

  it('searches tags', () => {
    const index = new SearchIndex();
    index.upsert(entry('a', 'Untitled', '', ['finance']));

    expect(index.search('fin').map((hit) => hit.id)).toEqual(['a']);
  });

  it('still finds the middle of a word, ranked after whole-word matches', () => {
    const index = new SearchIndex();
    index.upsert(entry('mid', 'Start here'));
    index.upsert(entry('word', 'Art history'));

    expect(index.search('art').map((hit) => hit.id)).toEqual(['word', 'mid']);
    expect(index.search('xyz')).toEqual([]);
  });

  it('re-indexes a changed entry, skips an unchanged one, and forgets removed ones', () => {
    const index = new SearchIndex();
    index.upsert(entry('a', 'First draft', '', [], '1'));
    index.upsert(entry('a', 'Second draft', '', [], '2'));

    expect(index.search('first')).toEqual([]);
    expect(index.search('second').map((hit) => hit.id)).toEqual(['a']);

    // Same stamp, different text: treated as unchanged.
    index.upsert(entry('a', 'Third draft', '', [], '2'));
    expect(index.search('third')).toEqual([]);

    index.retain(new Set());
    expect(index.size).toBe(0);
    expect(index.search('second')).toEqual([]);
  });
});
