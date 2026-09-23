import { describe, expect, it } from 'vitest';

import { clipboardCapture } from './capture-clipboard';

describe('clipboardCapture', () => {
  it('turns a lone URL into a link', () => {
    expect(clipboardCapture('  https://example.com/a?b=1 \n')).toEqual({
      kind: 'link',
      content: '',
      url: 'https://example.com/a?b=1',
      source: null,
    });
  });

  it('keeps anything else as a clipping', () => {
    expect(clipboardCapture('see https://example.com later').kind).toBe('clipboard');
    expect(clipboardCapture('javascript:alert(1)').kind).toBe('clipboard');
    expect(clipboardCapture('plain words', 'VS Code')).toEqual({
      kind: 'clipboard',
      content: 'plain words',
      source: 'VS Code',
    });
  });
});
