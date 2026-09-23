import { describe, expect, it } from 'vitest';

import { diffLines, diffStats } from './diff.ts';

describe('diffLines', () => {
  it('reports identical texts as unchanged', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
    ]);
  });

  it('finds an insertion and a removal in the middle', () => {
    const lines = diffLines('one\ntwo\nthree\nfour', 'one\nTWO\nthree\nfour\nfive');

    expect(lines).toEqual([
      { kind: 'same', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'added', text: 'TWO' },
      { kind: 'same', text: 'three' },
      { kind: 'same', text: 'four' },
      { kind: 'added', text: 'five' },
    ]);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('keeps the common lines between changes', () => {
    const lines = diffLines('a\nx\nb\ny\nc', 'a\nb\nc');
    expect(lines.filter((line) => line.kind === 'same').map((line) => line.text)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(diffStats(lines)).toEqual({ added: 0, removed: 2 });
  });

  it('handles an empty side', () => {
    expect(diffLines('', 'new')).toEqual([
      { kind: 'removed', text: '' },
      { kind: 'added', text: 'new' },
    ]);
  });
});
