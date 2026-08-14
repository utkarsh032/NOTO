import type {
  DocumentContent,
  DocumentStatus,
  Folder,
  NotoDocument,
  NotoFile,
  Workspace,
} from '@noto/types';

import type { SqlValue } from './driver';

/**
 * Row shapes and the mapping to and from domain objects.
 *
 * SQLite has no boolean or JSON type, so booleans travel as 0/1 and structured
 * values as TEXT. Nothing outside this module should know that.
 */

export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string | null;
  is_local: number;
  icon: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FolderRow {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRow {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content: string;
  status: string;
  excerpt: string;
  word_count: number;
  is_favorite: number;
  tags: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FileRow {
  id: string;
  workspace_id: string;
  document_id: string | null;
  name: string;
  mime_type: string;
  size: number;
  local_path: string | null;
  remote_url: string | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const EMPTY_CONTENT: DocumentContent = { type: 'doc', content: [] };

const DOCUMENT_STATUSES: readonly DocumentStatus[] = ['draft', 'active', 'archived'];

function toBoolean(value: number): boolean {
  return value !== 0;
}

function fromBoolean(value: boolean): number {
  return value ? 1 : 0;
}

/** Parses TEXT-encoded JSON, falling back rather than throwing on corrupt rows. */
function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toStatus(value: string): DocumentStatus {
  return DOCUMENT_STATUSES.includes(value as DocumentStatus) ? (value as DocumentStatus) : 'draft';
}

export function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    isLocal: toBoolean(row.is_local),
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function fromWorkspace(workspace: Workspace): SqlValue[] {
  return [
    workspace.id,
    workspace.name,
    workspace.ownerId,
    fromBoolean(workspace.isLocal),
    workspace.icon,
    workspace.createdAt,
    workspace.updatedAt,
    workspace.deletedAt,
  ];
}

export function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    color: row.color,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function fromFolder(folder: Folder): SqlValue[] {
  return [
    folder.id,
    folder.workspaceId,
    folder.parentId,
    folder.name,
    folder.position,
    folder.color,
    folder.icon,
    folder.createdAt,
    folder.updatedAt,
    folder.deletedAt,
  ];
}

export function toDocument(row: DocumentRow): NotoDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    folderId: row.folder_id,
    title: row.title,
    content: parseJson<DocumentContent>(row.content, EMPTY_CONTENT),
    status: toStatus(row.status),
    excerpt: row.excerpt,
    wordCount: row.word_count,
    isFavorite: toBoolean(row.is_favorite),
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function fromDocument(document: NotoDocument): SqlValue[] {
  return [
    document.id,
    document.workspaceId,
    document.folderId,
    document.title,
    JSON.stringify(document.content),
    document.status,
    document.excerpt,
    document.wordCount,
    fromBoolean(document.isFavorite),
    JSON.stringify(document.tags),
    document.createdAt,
    document.updatedAt,
    document.deletedAt,
  ];
}

export function toFile(row: FileRow): NotoFile {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    localPath: row.local_path,
    remoteUrl: row.remote_url,
    checksum: row.checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function fromFile(file: NotoFile): SqlValue[] {
  return [
    file.id,
    file.workspaceId,
    file.documentId,
    file.name,
    file.mimeType,
    file.size,
    file.localPath,
    file.remoteUrl,
    file.checksum,
    file.createdAt,
    file.updatedAt,
    file.deletedAt,
  ];
}
