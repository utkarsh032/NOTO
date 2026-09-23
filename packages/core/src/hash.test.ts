import { describe, expect, it } from 'vitest';

import { hashContent } from './hash.ts';

const paragraph = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('hashContent', () => {
  it('is stable for the same body', () => {
    expect(hashContent(paragraph('Hello'))).toBe(hashContent(paragraph('Hello')));
    expect(hashContent(paragraph('Hello'))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when the body changes', () => {
    expect(hashContent(paragraph('Hello'))).not.toBe(hashContent(paragraph('Hello!')));
  });

  it('ignores key order', () => {
    const a = { type: 'doc' as const, content: [{ type: 'text', text: 'x', marks: [] }] };
    const b = { content: [{ marks: [], text: 'x', type: 'text' }], type: 'doc' as const };

    expect(hashContent(a)).toBe(hashContent(b));
  });
});
