import { describe, expect, it } from 'vitest';

import { captureFromShare, routeHashFromLink } from './intake';

describe('routeHashFromLink', () => {
  it('opens the screen a link names', () => {
    expect(routeHashFromLink('noto://quick-note')).toBe('#/quick-note');
    expect(routeHashFromLink('noto://memory')).toBe('#/memory');
    expect(routeHashFromLink('noto:///memory')).toBe('#/memory');
  });

  it('keeps the segment after the screen', () => {
    expect(routeHashFromLink('noto://workspace/doc-1')).toBe('#/workspace/doc-1');
    expect(routeHashFromLink('noto://search/hello%20world')).toBe('#/search/hello%20world');
  });

  it('opens nothing for a link that names no screen', () => {
    expect(routeHashFromLink('noto://expo-sharing')).toBeNull();
    expect(routeHashFromLink('noto://')).toBeNull();
    expect(routeHashFromLink('noto://nowhere/else')).toBeNull();
  });

  it('opens nothing for another scheme or a malformed link', () => {
    expect(routeHashFromLink('https://example.com/memory')).toBeNull();
    expect(routeHashFromLink('javascript:alert(1)')).toBeNull();
    expect(routeHashFromLink('not a url')).toBeNull();
  });
});

describe('captureFromShare', () => {
  it('keeps a shared URL as a link', () => {
    expect(
      captureFromShare({ type: 'share', shareType: 'url', value: 'https://example.com/a' }),
    ).toEqual({ kind: 'link', content: '', url: 'https://example.com/a', source: 'Shared' });
  });

  it('keeps text that is only a URL as a link', () => {
    expect(
      captureFromShare({ type: 'share', shareType: 'text', value: '  https://example.com  ' }),
    ).toMatchObject({ kind: 'link', url: 'https://example.com/' });
  });

  it('keeps other text as a note', () => {
    expect(
      captureFromShare({
        type: 'share',
        shareType: 'text',
        value: 'Read https://example.com later',
      }),
    ).toEqual({
      kind: 'note',
      content: 'Read https://example.com later',
      source: 'Shared',
    });
  });

  it('keeps a URL share that is not a web address as text', () => {
    expect(
      captureFromShare({ type: 'share', shareType: 'url', value: 'mailto:someone@example.com' }),
    ).toMatchObject({ kind: 'note', content: 'mailto:someone@example.com' });
  });

  it('takes no files and no empty shares', () => {
    expect(
      captureFromShare({ type: 'share', shareType: 'image', value: 'file:///a.png' }),
    ).toBeNull();
    expect(captureFromShare({ type: 'share', shareType: 'text', value: '   ' })).toBeNull();
  });
});
