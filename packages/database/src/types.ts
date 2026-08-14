import type { DocumentStatus, Folder, Id, NotoDocument, NotoFile, Workspace } from '@noto/types';

/**
 * Options shared by every list query.
 *
 * Soft-deleted rows are excluded by default: tombstones exist for the sync
 * layer, and application code should have to ask for them explicitly.
 */
export interface ListOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsOptions extends ListOptions {
  folderId?: Id | null;
  status?: DocumentStatus;
  favoritesOnly?: boolean;
  /** `'updatedAt'` (newest first) unless stated otherwise. */
  orderBy?: 'updatedAt' | 'createdAt' | 'title';
}

export interface WorkspaceRepository {
  get(id: Id): Promise<Workspace | null>;
  list(options?: ListOptions): Promise<Workspace[]>;
  put(workspace: Workspace): Promise<void>;
  /** Removes the row outright. Use only once sync has confirmed the tombstone. */
  purge(id: Id): Promise<void>;
}

export interface FolderRepository {
  get(id: Id): Promise<Folder | null>;
  listByWorkspace(workspaceId: Id, options?: ListOptions): Promise<Folder[]>;
  put(folder: Folder): Promise<void>;
  putMany(folders: readonly Folder[]): Promise<void>;
  purge(id: Id): Promise<void>;
}

export interface DocumentRepository {
  get(id: Id): Promise<NotoDocument | null>;
  listByWorkspace(workspaceId: Id, options?: ListDocumentsOptions): Promise<NotoDocument[]>;
  put(document: NotoDocument): Promise<void>;
  putMany(documents: readonly NotoDocument[]): Promise<void>;
  purge(id: Id): Promise<void>;
  /** Case-insensitive match over title and excerpt. */
  search(workspaceId: Id, query: string, options?: ListOptions): Promise<NotoDocument[]>;
  countByWorkspace(workspaceId: Id): Promise<number>;
}

export interface FileRepository {
  get(id: Id): Promise<NotoFile | null>;
  listByDocument(documentId: Id, options?: ListOptions): Promise<NotoFile[]>;
  put(file: NotoFile): Promise<void>;
  purge(id: Id): Promise<void>;
}

/**
 * The single storage contract every Noto platform implements: IndexedDB/Dexie
 * on web, SQLite on desktop and mobile. Application and UI code depends on this
 * interface only, never on a concrete engine.
 */
export interface NotoDatabase {
  readonly workspaces: WorkspaceRepository;
  readonly folders: FolderRepository;
  readonly documents: DocumentRepository;
  readonly files: FileRepository;

  /** Opens the connection and applies any pending migrations. */
  open(): Promise<void>;
  close(): Promise<void>;
  /** Drops all local data. Used by "reset local data" and by tests. */
  clear(): Promise<void>;
}
