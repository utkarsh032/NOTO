import { UNTITLED_DOCUMENT_TITLE } from '@noto/config';
import type {
  CreateDocumentInput,
  DocumentContent,
  NotoDocument,
  UpdateDocumentInput,
} from '@noto/types';

import { type Clock, systemClock } from './clock.ts';
import { createId } from './id.ts';
import { buildExcerpt, countWords, plainTextFromContent } from './text.ts';

/** The content an editor starts from: a document with one empty paragraph. */
export const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export interface DocumentDeps {
  clock?: Clock;
  generateId?: () => string;
}

/** Recomputes the fields that are always derived from the document body. */
function deriveContentFields(
  content: DocumentContent,
): Pick<NotoDocument, 'excerpt' | 'wordCount'> {
  const plainText = plainTextFromContent(content);
  return {
    excerpt: buildExcerpt(plainText),
    wordCount: countWords(plainText),
  };
}

export function createDocument(input: CreateDocumentInput, deps: DocumentDeps = {}): NotoDocument {
  const clock = deps.clock ?? systemClock;
  const generateId = deps.generateId ?? createId;
  const timestamp = clock.now();
  const content = input.content ?? EMPTY_DOCUMENT_CONTENT;

  return {
    id: generateId(),
    workspaceId: input.workspaceId,
    folderId: input.folderId ?? null,
    title: input.title?.trim() || UNTITLED_DOCUMENT_TITLE,
    content,
    status: 'draft',
    isFavorite: false,
    tags: input.tags ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...deriveContentFields(content),
  };
}

/**
 * Applies a patch and returns a new document. Excerpt, word count and
 * `updatedAt` are always recomputed here rather than by callers, so no code
 * path can persist a document whose derived fields have gone stale.
 */
export function updateDocument(
  document: NotoDocument,
  patch: UpdateDocumentInput,
  deps: DocumentDeps = {},
): NotoDocument {
  const clock = deps.clock ?? systemClock;
  const content = patch.content ?? document.content;

  const next: NotoDocument = {
    ...document,
    ...patch,
    content,
    updatedAt: clock.now(),
    ...deriveContentFields(content),
  };

  // A draft becomes active as soon as it has been edited into something real.
  if (next.status === 'draft' && next.wordCount > 0) {
    next.status = 'active';
  }

  return next;
}

export function archiveDocument(document: NotoDocument, deps: DocumentDeps = {}): NotoDocument {
  const clock = deps.clock ?? systemClock;
  return { ...document, status: 'archived', updatedAt: clock.now() };
}

export function restoreDocument(document: NotoDocument, deps: DocumentDeps = {}): NotoDocument {
  const clock = deps.clock ?? systemClock;
  return { ...document, status: 'active', deletedAt: null, updatedAt: clock.now() };
}

/**
 * Soft-deletes a document. Noto never hard-deletes on the client: the tombstone
 * is what tells the sync layer to remove the row on other devices.
 */
export function deleteDocument(document: NotoDocument, deps: DocumentDeps = {}): NotoDocument {
  const clock = deps.clock ?? systemClock;
  const timestamp = clock.now();
  return { ...document, deletedAt: timestamp, updatedAt: timestamp };
}

export function isDeleted(document: Pick<NotoDocument, 'deletedAt'>): boolean {
  return document.deletedAt !== null;
}
