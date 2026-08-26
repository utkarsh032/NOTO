import type { Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

import { NotoKeymap } from './keymap';

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

/** Blocks that can be aligned. Marks and list items follow their container. */
const ALIGNABLE_TYPES = ['heading', 'paragraph'];

export function createNotoExtensions(options: NotoExtensionOptions = {}): Extensions {
  const { headingLevels = [1, 2, 3] } = options;

  return [
    StarterKit.configure({
      heading: { levels: headingLevels },

      link: {
        /*
         * A click inside the editor puts the caret in the link, it does not
         * follow it — otherwise fixing a typo in linked text would navigate
         * away mid-edit. The toolbar offers an explicit way to open it.
         */
        openOnClick: false,
        /** Typing a bare URL turns it into a link, which is what people expect. */
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          // Applies wherever a document is rendered outside the editor: export,
          // print, the eventual shared view.
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      },
    }),

    TextAlign.configure({ types: ALIGNABLE_TYPES }),

    Image.configure({
      /*
       * Images sit in their own block rather than inline in a sentence, and
       * `data:` sources are kept: a picture pasted from the clipboard arrives
       * that way, and dropping it would lose the user's content silently.
       * Images referenced by URL stay by URL — Noto has no asset store until
       * §6.8 Image Capture, so nothing is copied into the document behind the
       * user's back.
       */
      inline: false,
      allowBase64: true,
    }),

    TableKit.configure({
      table: { resizable: true },
    }),

    // Last, so its bindings take precedence over the defaults above.
    NotoKeymap,
  ];
}
