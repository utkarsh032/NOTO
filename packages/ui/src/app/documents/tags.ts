/** The longest a tag may be. Longer is a sentence, not a label. */
export const MAX_TAG_LENGTH = 40;

/**
 * A tag as the person typed it, tidied: trimmed, inner whitespace collapsed,
 * a leading `#` dropped, cut to length. Empty means "not a tag".
 */
export function normaliseTag(input: string): string {
  return input.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
}

/**
 * Adds tags to a list, skipping any already there. Compared without case, so
 * "Work" and "work" are one tag; the spelling first used is the one kept.
 */
export function addTags(current: readonly string[], input: string): string[] {
  const next = [...current];
  const seen = new Set(current.map((tag) => tag.toLowerCase()));

  for (const part of input.split(',')) {
    const tag = normaliseTag(part);
    if (tag === '' || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }

  return next;
}
