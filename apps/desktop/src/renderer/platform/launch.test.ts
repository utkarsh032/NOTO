import { describe, expect, it } from 'vitest';

import { routeHashFromLink } from './launch';

describe('routeHashFromLink', () => {
  it('opens the screen a link names, from the host or the path', () => {
    expect(routeHashFromLink('noto://memory')).toBe('#/memory');
    expect(routeHashFromLink('noto:///memory/')).toBe('#/memory');
  });

  it('keeps a document id', () => {
    expect(routeHashFromLink('noto://workspace/doc-1')).toBe('#/workspace/doc-1');
  });

  it('opens nothing for an unknown screen, another scheme or no screen at all', () => {
    expect(routeHashFromLink('noto://nowhere')).toBeNull();
    expect(routeHashFromLink('https://memory')).toBeNull();
    expect(routeHashFromLink('noto://')).toBeNull();
    expect(routeHashFromLink('garbage')).toBeNull();
  });
});
