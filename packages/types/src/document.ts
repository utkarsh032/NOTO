import type { Entity, Id } from './common.ts';

/**
 * The editor's structured content. Noto stores ProseMirror/Tiptap JSON rather
 * than HTML or Markdown so the document model stays canonical across platforms.
 */
export interface DocumentContent {
  type: 'doc';
  content?: unknown[];
}

export type DocumentStatus = 'draft' | 'active' | 'archived';

export interface NotoDocument extends Entity {
  workspaceId: Id;
  /** `null` means the document sits at the workspace root. */
  folderId: Id | null;
  title: string;
  content: DocumentContent;
  status: DocumentStatus;
  /** Plain-text projection of `content`, kept for search and previews. */
  excerpt: string;
  wordCount: number;
  isFavorite: boolean;
  tags: string[];
}

/** The fields a caller supplies when creating a document; the rest are derived. */
export interface CreateDocumentInput {
  workspaceId: Id;
  folderId?: Id | null;
  title?: string;
  content?: DocumentContent;
  tags?: string[];
}

/** Every field that may be changed after creation. */
export type UpdateDocumentInput = Partial<
  Pick<NotoDocument, 'title' | 'content' | 'folderId' | 'status' | 'isFavorite' | 'tags'>
>;
