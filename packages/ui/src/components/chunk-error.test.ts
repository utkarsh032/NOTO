import { describe, expect, it } from 'vitest';

import { isChunkLoadError } from './chunk-error';

describe('isChunkLoadError', () => {
  it('recognises the messages browsers use for a missing lazy chunk', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('leaves ordinary render errors alone', () => {
    expect(
      isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe(false);
  });
});
