import { generateJSON } from '@tiptap/core';
import type { DocumentContent } from '@noto/types';

import { createNotoExtensions } from './extensions';

/**
 * HTML, read into a Noto document through the editor's own schema.
 *
 * The schema is the sanitiser: ProseMirror keeps only the nodes, marks and
 * attributes the editor defines and drops everything else — scripts, styles,
 * event handlers, iframes — rather than Noto maintaining a second list of what
 * is allowed. Headings, lists, tables, links, emphasis and alignment survive;
 * a link or image whose URL the editor would refuse is refused here too.
 *
 * Needs a DOM (`DOMParser`), which every Noto surface has: the browser, the
 * Electron renderer and the mobile WebView.
 */
export function htmlToContent(html: string): DocumentContent {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  const json = generateJSON(body, createNotoExtensions()) as DocumentContent;

  return json.content && json.content.length > 0
    ? json
    : { type: 'doc', content: [{ type: 'paragraph' }] };
}
