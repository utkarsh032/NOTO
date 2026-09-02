import { describe, expect, it } from 'vitest';

import { buildExcerpt, countWords, deriveTitle, plainTextFromContent, slugify } from './text.ts';

const doc = (...paragraphs: string[]) => ({
  type: 'doc' as const,
  content: paragraphs.map((text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })),
});

describe('plainTextFromContent', () => {
  it('joins block nodes with newlines', () => {
    expect(plainTextFromContent(doc('First block', 'Second block'))).toBe(
      'First block\nSecond block',
    );
  });

  it('returns an empty string for an empty document', () => {
    expect(plainTextFromContent({ type: 'doc', content: [] })).toBe('');
    expect(plainTextFromContent({ type: 'doc' })).toBe('');
  });

  it('reads text out of nested nodes', () => {
    const nested = {
      type: 'doc' as const,
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested item' }] }],
            },
          ],
        },
      ],
    };

    expect(plainTextFromContent(nested)).toBe('Nested item');
  });
});

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('one two three')).toBe(3);
  });

  it('treats blank input as zero', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('')).toBe(0);
  });
});

describe('buildExcerpt', () => {
  it('leaves short text untouched', () => {
    expect(buildExcerpt('Short note', 40)).toBe('Short note');
  });

  it('truncates on a word boundary and marks the cut', () => {
    const excerpt = buildExcerpt('alpha beta gamma delta epsilon', 20);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(21);
    expect(excerpt).not.toContain('  ');
  });
});

describe('deriveTitle', () => {
  it('uses the first line of the body', () => {
    expect(deriveTitle(doc('Meeting notes', 'Body text'))).toBe('Meeting notes');
  });

  it('falls back to Untitled for an empty document', () => {
    expect(deriveTitle({ type: 'doc', content: [] })).toBe('Untitled');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World  Again')).toBe('hello-world-again');
  });

  it('strips accents and punctuation', () => {
    expect(slugify('Café — Notes!')).toBe('cafe-notes');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Draft--  ')).toBe('draft');
  });
});
