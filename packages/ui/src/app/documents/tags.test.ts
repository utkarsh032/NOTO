import { describe, expect, it } from 'vitest';

import { addTags, normaliseTag } from './tags';

describe('tags', () => {
  it('tidies what was typed', () => {
    expect(normaliseTag('  #Project   Alpha ')).toBe('Project Alpha');
    expect(normaliseTag('   ')).toBe('');
    expect(normaliseTag('x'.repeat(60))).toHaveLength(40);
  });

  it('adds several at once and never the same tag twice', () => {
    expect(addTags(['Work'], 'work, ideas,  , Ideas, #later')).toEqual(['Work', 'ideas', 'later']);
  });
});
