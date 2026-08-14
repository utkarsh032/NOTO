import { EMPTY_DOCUMENT_CONTENT, plainTextFromContent } from '@noto/core';
import type { DocumentContent } from '@noto/types';
import type { JSONContent } from '@tiptap/core';

/**
 * Noto stores Tiptap's own JSON, so these conversions are structural rather
 * than lossy transforms. They exist to keep the cast in one place and to give
 * the boundary a name.
 */

export function toEditorContent(content: DocumentContent): JSONContent {
  return content as JSONContent;
}

export function fromEditorContent(json: JSONContent): DocumentContent {
  if (json.type !== 'doc') return EMPTY_DOCUMENT_CONTENT;
  return json as DocumentContent;
}

/** True when the document has no text in it, regardless of empty block nodes. */
export function isEmptyContent(content: DocumentContent): boolean {
  return plainTextFromContent(content) === '';
}

export { EMPTY_DOCUMENT_CONTENT };
