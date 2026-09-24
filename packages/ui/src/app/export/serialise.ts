import { plainTextFromContent } from '@noto/core';
import type { NotoDocument } from '@noto/types';

import type { ExportFormat } from './formats';
import { documentToHtml } from './html';
import { documentToMarkdown } from './markdown';

/**
 * Several documents as one.
 *
 * Every export format Noto writes is a single file, and a browser cannot be
 * asked for twenty downloads at once without half of them being blocked. So a
 * bulk export is one document with each of the originals under its own
 * heading — which is also what someone asking for "all of it" usually wants to
 * read afterwards.
 */
export function bundleDocuments(
  documents: readonly Pick<NotoDocument, 'title' | 'content'>[],
  title: string,
): Pick<NotoDocument, 'title' | 'content'> {
  const content: unknown[] = [];

  for (const [index, document] of documents.entries()) {
    if (index > 0) content.push({ type: 'horizontalRule' });

    content.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: document.title || 'Untitled' }],
    });
    content.push(...((document.content.content ?? []) as unknown[]));
  }

  return { title, content: { type: 'doc', content } };
}

/* -------------------------------------------------------------------------- */
/* Writing the file                                                           */
/* -------------------------------------------------------------------------- */

export function documentToText(document: Pick<NotoDocument, 'title' | 'content'>): string {
  return `${document.title || 'Untitled'}\n\n${plainTextFromContent(document.content)}\n`;
}

export function serialiseDocument(
  document: Pick<NotoDocument, 'title' | 'content'>,
  format: ExportFormat,
): string {
  switch (format) {
    case 'md':
      return documentToMarkdown(document);
    case 'html':
      return documentToHtml(document);
    case 'json':
      return JSON.stringify({ title: document.title, content: document.content }, null, 2);
    default:
      return documentToText(document);
  }
}
