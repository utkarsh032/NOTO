import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

/**
 * The Noto document schema.
 *
 * Every platform builds its editor from this one list, so a document written on
 * desktop parses identically on web and mobile. Extensions are added here only
 * when the matching feature is actually implemented — an extension present on
 * one platform but not another would silently drop content on load.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface NotoExtensionOptions {
  /** Heading levels the document model accepts. */
  headingLevels?: HeadingLevel[];
}

export function createNotoExtensions(options: NotoExtensionOptions = {}): Extensions {
  const { headingLevels = [1, 2, 3] } = options;

  return [
    StarterKit.configure({
      heading: { levels: headingLevels },
    }),
  ];
}
