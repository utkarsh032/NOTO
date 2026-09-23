import type {
  DocumentContent,
  DocumentStatus,
  DocumentVersionRecord,
  Folder,
  MemoryItem,
  MemoryKind,
  NotoDocument,
  NotoFile,
  OutboxEntry,
  SyncEntityKind,
  SyncOperation,
  VersionOrigin,
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
  version: number;
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
  version: number;
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
  version: number;
  content_hash: string | null;
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
  version: number;
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
    version: row.version,
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
    version: row.version,
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
    version: row.version,
    ...(row.content_hash === null ? {} : { contentHash: row.content_hash }),
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
    version: row.version,
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

export interface MemoryRow {
  id: string;
  workspace_id: string;
  kind: string;
  title: string;
  content: string;
  source: string | null;
  url: string | null;
  tags: string;
  is_pinned: number;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

const MEMORY_KINDS: readonly MemoryKind[] = [
  'note',
  'clipboard',
  'screenshot',
  'image',
  'link',
  'file',
];

export function toMemoryItem(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: MEMORY_KINDS.includes(row.kind as MemoryKind) ? (row.kind as MemoryKind) : 'note',
    title: row.title,
    content: row.content,
    source: row.source,
    url: row.url,
    tags: parseJson<string[]>(row.tags, []),
    isPinned: toBoolean(row.is_pinned),
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

export function fromMemoryItem(item: MemoryItem): SqlValue[] {
  return [
    item.id,
    item.workspaceId,
    item.kind,
    item.title,
    item.content,
    item.source,
    item.url,
    JSON.stringify(item.tags),
    fromBoolean(item.isPinned),
    item.sizeBytes,
    item.createdAt,
    item.updatedAt,
    item.deletedAt,
  ];
}

export interface VersionRow {
  id: string;
  document_id: string;
  workspace_id: string;
  title: string;
  content: string;
  word_count: number;
  content_hash: string;
  origin: string;
  summary: string | null;
  created_at: string;
}

const VERSION_ORIGINS: readonly VersionOrigin[] = [
  'manual',
  'autosave',
  'restore',
  'conflict',
  'import',
];

export function toVersion(row: VersionRow): DocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: parseJson<DocumentContent>(row.content, EMPTY_CONTENT),
    wordCount: row.word_count,
    contentHash: row.content_hash,
    origin: VERSION_ORIGINS.includes(row.origin as VersionOrigin)
      ? (row.origin as VersionOrigin)
      : 'autosave',
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export function fromVersion(version: DocumentVersionRecord): SqlValue[] {
  return [
    version.id,
    version.documentId,
    version.workspaceId,
    version.title,
    JSON.stringify(version.content),
    version.wordCount,
    version.contentHash,
    version.origin,
    version.summary,
    version.createdAt,
  ];
}

export interface OutboxRow {
  entity_kind: string;
  entity_id: string;
  operation: string;
  seq: number;
  queued_at: string;
}

export function toOutboxEntry(row: OutboxRow): OutboxEntry {
  return {
    entityKind: row.entity_kind as SyncEntityKind,
    entityId: row.entity_id,
    operation: row.operation as SyncOperation,
    seq: row.seq,
    queuedAt: row.queued_at,
  };
}
