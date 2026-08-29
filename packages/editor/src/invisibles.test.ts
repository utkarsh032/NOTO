import { getSchema } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';

import { createNotoExtensions } from './extensions';
import { SPACE_CLASS, TAB_CLASS, buildInvisibleDecorations } from './invisibles';

/*
 * The real Noto schema, so these tests break if the document model changes
 * shape underneath the feature rather than passing against a toy of their own.
 */
const schema = getSchema(createNotoExtensions());

function docOf(...paragraphs: string[]): ProseMirrorNode {
  return schema.node(
    'doc',
    null,
    paragraphs.map((text) =>
      schema.node('paragraph', null, text === '' ? [] : [schema.text(text)]),
    ),
  );
}

/**
 * Every decoration, flattened to something a test can read.
 *
 * An inline decoration keeps its attributes on `type` while a widget keeps its
 * options on `spec`; neither is in the public typings, hence the casts.
 */
function markers(doc: ProseMirrorNode, from = 0, to = doc.content.size) {
  return buildInvisibleDecorations(doc, from, to).map((decoration) => ({
    from: decoration.from,
    to: decoration.to,
    class:
      (decoration as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs?.class ??
      null,
    key: (decoration.spec as { key?: string }).key ?? null,
  }));
}

describe('buildInvisibleDecorations', () => {
  it('marks every space in a paragraph', () => {
    // "a b c" — positions 1..5, spaces at 2 and 4.
    const spaces = markers(docOf('a b c')).filter((marker) => marker.class?.includes(SPACE_CLASS));

    expect(spaces.map((space) => space.from)).toEqual([2, 4]);
    expect(spaces.every((space) => space.to === space.from + 1)).toBe(true);
  });

  it('marks consecutive spaces individually, so the count is visible', () => {
    const spaces = markers(docOf('a   b')).filter((marker) => marker.class?.includes(SPACE_CLASS));

    expect(spaces.map((space) => space.from)).toEqual([2, 3, 4]);
  });

  it('distinguishes tabs from spaces', () => {
    const tabs = markers(docOf('a\tb')).filter((marker) => marker.class?.includes(TAB_CLASS));

    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.from).toBe(2);
  });

  it('ends every block with a paragraph marker, empty blocks included', () => {
    const doc = docOf('one', '', 'two');
    const ends = markers(doc).filter((marker) => marker.key === 'noto-invisible-paragraph');

    // Just inside each closing token: 'one' spans 0–5, the empty block 5–7,
    // 'two' 7–12.
    expect(ends.map((end) => end.from)).toEqual([4, 6, 11]);
  });

  it('decorates a hard break where the break itself sits', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('a'),
        schema.node('hardBreak'),
        schema.text('b'),
      ]),
    ]);

    const breaks = markers(doc).filter((marker) => marker.key === 'noto-invisible-break');

    expect(breaks.map((mark) => mark.from)).toEqual([2]);
  });

  it('only decorates inside the range it is given', () => {
    const doc = docOf('a b', 'c d');

    // The second paragraph alone: it starts at 5 and ends at 10.
    const spaces = markers(doc, 5, 10).filter((marker) => marker.class?.includes(SPACE_CLASS));

    expect(spaces.map((space) => space.from)).toEqual([7]);
  });

  it('finds nothing in a document with nothing invisible but its block ends', () => {
    const decorations = markers(docOf('abc'));

    expect(decorations.filter((marker) => marker.class !== null)).toEqual([]);
    expect(decorations).toHaveLength(1);
  });
});
